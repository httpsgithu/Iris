import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { pick } from 'lodash';
import Modal from './Modal';
import {
  setWindowTitle,
  set as setUi,
  createNotification,
  closeModal,
} from '../../services/ui/actions';
import * as spotifyActions from '../../services/spotify/actions';
import * as snapcastActions from '../../services/snapcast/actions';
import * as lastfmActions from '../../services/lastfm/actions';
import * as geniusActions from '../../services/genius/actions';
import { i18n, I18n } from '../../locale';
import Button from '../../components/Button';
import { useParams } from 'react-router';

const ImportConfig = () => {
  const { source = 'pushed' } = useParams();
  const dispatch = useDispatch();
  const [selected, setSelected] = useState([]);
  const configFromState = useSelector((state) => state.ui.modal?.props?.config || {});
  const configFromServer = useSelector((state) => state.pusher.shared_config || {});
  const config = source === 'server' ? configFromServer : configFromState;

  useEffect(() => {
    setWindowTitle(i18n(`modal.shared_config.${source}.title`));
  }, []);

  const onSelectedChanged = (name) => {
    setSelected((prev) => {
      if (prev.indexOf(name) > -1) return prev.filter((prevName) => prevName !== name);

      return [...prev, name];
    });
  }

  const onSubmit = (e) => {
    e.preventDefault();
    const toImport = pick(config, selected);

    if (toImport.ui) {
      dispatch(setUi(toImport.ui));
    }
    if (toImport.spotify) {
      dispatch(spotifyActions.importAuthorization(
        toImport.spotify.authorization,
        toImport.spotify.me,
      ));
    }
    if (toImport.snapcast) {
      dispatch(snapcastActions.set(toImport.snapcast));
      setTimeout(() => dispatch(snapcastActions.connect()), 100);
    }
    if (toImport.lastfm) {
      dispatch(lastfmActions.importAuthorization(
        toImport.lastfm.authorization,
        toImport.lastfm.me,
      ));
    }
    if (toImport.genius) {
      dispatch(geniusActions.importAuthorization(
        toImport.genius.authorization,
        toImport.genius.me,
      ));
    }
    dispatch(createNotification({
      content: i18n('modal.shared_config.imported'),
    }));

    dispatch(closeModal());
  }

  return (
    <Modal className="modal--share-configuration">
      <h1>
        <I18n path={`modal.shared_config.${source}.title`} />
      </h1>
      <h2>
        <I18n path={`modal.shared_config.${source}.subtitle`} />
      </h2>

      <form onSubmit={onSubmit}>
        <div className="field checkbox checkbox--block">
          <div className="name">
            <I18n path="modal.shared_config.config.label" />
          </div>
          <div className="input">

            {Object.keys(config).map((name) => (
              <div className="checkbox-group__item" key={`configuration_${name}`}>
                <label>
                  <input
                    type="checkbox"
                    name={`configuration_to_import_${name}`}
                    checked={selected.indexOf(name) > -1}
                    onChange={() => onSelectedChanged(name)}
                  />
                  <div className="label">
                    <div>
                      <div className="title">
                        <I18n path={`modal.shared_config.config.${name}.label`} />
                      </div>
                      <div className="description mid_grey-text">
                        <I18n
                          path={`modal.shared_config.config.${name}.description`}
                          name={config[name].me?.name || 'Unknown'}
                        />
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="actions centered-text">
          <Button
            type="primary"
            size="large"
            disabled={selected.length <= 0}
            onClick={onSubmit}
            tracking={{ category: 'ImportConfiguration', action: 'Import' }}
          >
            <I18n path="modal.shared_config.import_now" />
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default ImportConfig;
