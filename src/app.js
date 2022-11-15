import i18next from 'i18next';
import * as yup from 'yup';
import _ from 'lodash';
import axios from 'axios';
import watcher from './view.js';
import resources from './locales/index.js';
import parser from './parser.js';

const getUrl = (url) => {
  const proxy = 'https://allorigins.hexlet.app';
  const params = { disableCache: true, url };
  const proxyUrl = new URL('/get', proxy);
  const searchParams = new URLSearchParams(params);
  proxyUrl.search = searchParams;
  return proxyUrl.toString();
};

const validate = (url, feeds) => {
  const schema = yup.string().required().url().notOneOf(feeds);
  return schema.validate(url, { abortEarly: false });
};

export default () => {
  const defaultLanguage = 'ru';
  const delay = 5000;
  const i18n = i18next.createInstance();

  i18n.init({
    lng: defaultLanguage,
    debug: true,
    resources,
  }).then(() => {
    yup.setLocale({
      string: {
        url: 'errors.urlError',
      },
      mixed: {
        notOneOf: 'errors.alreadyExist',
      },
    });
  });

  const elements = {
    form: document.querySelector('.rss-form'),
    input: document.querySelector('#url-input'),
    button: document.querySelector('.h-100'),
    feedback: document.querySelector('.feedback'),
    feeds: document.querySelector('.feeds'),
    posts: document.querySelector('.posts'),
    modalFade: document.querySelector('#modal'),
    modalTitle: document.querySelector('#modal .modal-title'),
    body: document.querySelector('#modal .modal-body'),
    redirect: document.querySelector('#modal a'),
  };

  const state = {
    form: {
      process: '',
      errors: '',
    },
    links: [],
    feeds: [],
    posts: [],
    currentPosts: {},
    alreadyReadPosts: [],
  };

  const watchedState = watcher(elements, i18n, state);

  const update = () => {
    const { feeds, posts } = state;

    const promises = feeds.map((feed) => {
      const url = getUrl(feed.link);

      const getNewPosts = axios.get(url).then((response) => {
        const data = parser(response.data.contents);
        const currentPosts = data.posts.map((post) => ({ ...post, id: feed.id }));
        const oldPosts = posts.filter((post) => post.id === feed.id);
        const newPosts = _.differenceWith(currentPosts, oldPosts, _.isEqual);

        if (newPosts.length > 0) {
          newPosts.forEach((post) => {
            watchedState.posts.push(post);
          });
        }
      });
      return getNewPosts;
    });

    Promise.all(promises).finally(() => { setTimeout(update, delay); });
  };

  elements.form.addEventListener('submit', (e) => {
    e.preventDefault();
    watchedState.form.process = 'loading';
    watchedState.form.errors = null;

    const form = new FormData(e.target);
    const url = form.get('url');

    validate(url, watchedState.links)
      .then((validUrl) => {
        const rssNews = axios.get(getUrl(validUrl));
        return rssNews;
      })
      .then((response) => {
        const { feed, posts } = parser(response.data.contents);

        watchedState.links.push(url);
        watchedState.form.process = 'success';

        const id = _.uniqueId();
        watchedState.feeds.push({ ...feed, id, link: url });

        posts.forEach((post) => watchedState.posts.push({ ...post, id }));
      })
      .catch((err) => {
        watchedState.form.process = 'failed';
        watchedState.form.errors = err.errors.join();
      });
  });

  elements.posts.addEventListener('click', (e) => {
    const currentLink = e.target.href ?? e.target.previousElementSibling.href;
    const indexOfPost = state.posts.findIndex((item) => item.link === currentLink);
    watchedState.currentPosts = indexOfPost;

    if (!state.alreadyReadPosts.includes(state.posts[indexOfPost])) {
      state.alreadyReadPosts.push(state.posts[indexOfPost]);
    }
  });

  update();
};
