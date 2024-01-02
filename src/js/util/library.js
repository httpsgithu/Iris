import { compact } from 'lodash';
import { formatContext } from './format';
import localForage from 'localforage';
import { stopLoading } from '../services/ui/actions';
import { enqueueURIs, playURIs } from '../services/mopidy/actions';
import {
  setLoading,
  loadItems,
  restoreItemsFromColdStore,
} from '../services/core/actions';

/**
 * Inspect object to check for missing dependent properties
 *
 * @param {Object} = item, dependents, fullDependents, full
 */
const getMissingDependents = ({
  item,
  dependents = [],
  fullDependents = [],
  full,
}) => {
  const allDependents = [
    ...dependents,
    ...fullDependents,
  ];
  if (!item) return allDependents;
  if (full) {
    return allDependents.filter((dep) => item[dep] === undefined || item[dep] === null);
  }
  return dependents.filter((dep) => item[dep] === undefined || item[dep] === null);
};

/**
 * Pluck all the URIs out of our dependent properties.
 *
 * @param {Object} = item, dependents, fullDependents
 */
const getDependentUris = ({
  item,
  dependents = [],
  fullDependents = [],
}) => {
  if (!item) return [];

  const getUrisOfDependent = (dep) => {
    if (!dep.match(new RegExp('(.*)_uri(.*)'))) return [];
    const uris = item[dep];

    if (uris && Array.isArray(uris)) return uris;

    return [];
  };

  return [...dependents, ...fullDependents].reduce(
    (acc, dep) => [
      ...acc,
      ...getUrisOfDependent(dep),
    ],
    [],
  );
};

/**
 * Ensure we have an item in our index
 * If it's not there, attempt to fetch it from our cold storage
 * If it's not their either, call the provided fetch()
 *
 * @param {*} Object { store, action, fetch, dependents}
 */
const ensureLoaded = ({
  store,
  containerName = 'items',
  action,
  fetch,
  dependents = [],
  fullDependents = [],
  type,
}) => {
  const {
    uri,
    options: {
      forceRefetch,
      full,
      callbackAction,
    },
  } = action;
  const {
    core: {
      [containerName]: {
        [uri]: item,
      } = {},
    } = {},
  } = store.getState();
  const dispatch = store.dispatch;

  // Forced refetch bypasses everything
  if (forceRefetch) {
    console.info(`Force-refetching "${uri}"`);
    store.dispatch(setLoading(uri, true));
    fetch();
    return;
  }

  const missingDependents = (itemToCheck) => getMissingDependents({
    item: itemToCheck,
    dependents,
    fullDependents,
    full,
  });

  const dependentUris = (itemToCheck) => getDependentUris({
    item: itemToCheck,
    dependents,
    fullDependents,
  });

  const runCallback = (item) => {
    switch (callbackAction.name) {
      case 'enqueue':
        dispatch(enqueueURIs({
          uris: [item.uri],
          from: formatContext(item),
          ...callbackAction,
        }));
        break;
      case 'play':
        dispatch(playURIs({
          uris: [item.uri],
          from: formatContext(item),
          ...callbackAction,
        }));
        break;
      default:
        break;
    }
  }

  // Item already in our index?
  if (item) {
    if (missingDependents(item).length === 0) {
      store.dispatch(stopLoading(uri));
      console.info(`"${uri}" already in index`);

      const uris = dependentUris(item);
      if (uris.length) {
        console.info(`Loading ${uris.length} dependents`, { uris });
        store.dispatch(loadItems(type, uris));
      }

      if (callbackAction) runCallback(item);
      return;
    }
  }

  // What about in the coldstore?
  localForage.getItem(uri).then((restoredItem) => {
    if (!restoredItem || missingDependents(restoredItem).length > 0) {
      store.dispatch(setLoading(uri, true));
      fetch();
      return;
    }

    console.info(`Restoring "${uri}" from database`);
    store.dispatch(restoreItemsFromColdStore([restoredItem]));
    if (callbackAction) runCallback(restoredItem);

    // We already have the dependents of our restored item, so restore them.
    // We assume that because THIS item is in the coldstore, its dependents
    // are as well.
    const uris = dependentUris(restoredItem);
    if (uris.length > 0) {
      console.info(`Restoring ${uris.length} dependents from database`);

      const restoreAllDependents = uris.map(
        (dependentUri) => localForage.getItem(dependentUri),
      );
      Promise.all(restoreAllDependents).then(
        (dependentItems) => {
          store.dispatch(
            restoreItemsFromColdStore(
              compact(dependentItems), // Squash nulls (ie items not found in coldstore)
            ),
          );
        },
      );
    }
  });
};

export {
  getMissingDependents,
  getDependentUris,
  ensureLoaded,
};

export default {
  getMissingDependents,
  getDependentUris,
  ensureLoaded,
};
