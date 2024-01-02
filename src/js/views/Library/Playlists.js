import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Button from '../../components/Button';
import { Grid } from '../../components/Grid';
import { List } from '../../components/List';
import DropdownField from '../../components/Fields/DropdownField';
import Header from '../../components/Header';
import FilterField from '../../components/Fields/FilterField';
import Icon from '../../components/Icon';
import * as coreActions from '../../services/core/actions';
import * as uiActions from '../../services/ui/actions';
import * as mopidyActions from '../../services/mopidy/actions';
import * as spotifyActions from '../../services/spotify/actions';
import { applyFilter, removeDuplicates, sortItems } from '../../util/arrays';
import { I18n, i18n } from '../../locale';
import Loader from '../../components/Loader';
import {
  makeLibrarySelector,
  makeProcessProgressSelector,
  makeProvidersSelector,
  getLibrarySource,
  getSortSelector,
} from '../../util/selectors';
import { formatSimpleObject } from '../../util/format';

const SORT_KEY = 'library_playlists';
const processKeys = [
  'MOPIDY_GET_LIBRARY_PLAYLISTS',
  'SPOTIFY_GET_LIBRARY_PLAYLISTS',
];

class Playlists extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      filter: '',
    };
  }

  componentDidMount() {
    const {
      uiActions: {
        setWindowTitle,
      },
    } = this.props;

    setWindowTitle(i18n('library.playlists.title'));

    this.getLibraries();
  }

  refresh = () => {
    const { uiActions: { hideContextMenu } } = this.props;

    hideContextMenu();
    this.getLibraries(true);
  }

  cancelRefresh = () => {
    const { uiActions: { hideContextMenu, cancelProcess } } = this.props;

    hideContextMenu();
    cancelProcess(processKeys);
  }

  componentDidUpdate = ({ source: prevSource }) => {
    const { source } = this.props;

    if (source !== prevSource) {
      this.getLibraries();
    }
  }

  getLibraries = (forceRefetch = false) => {
    const {
      source,
      providers,
      coreActions: {
        loadLibrary,
      },
    } = this.props;

    let uris = [];
    if (source === 'all') {
      uris = providers.map((p) => p.uri);
    } else {
      uris.push(source);
    }
    uris.forEach((uri) => loadLibrary(uri, 'playlists', { forceRefetch }));
  };

  onSortChange = (field) => {
    const {
      sortField,
      sortReverse,
      uiActions: {
        setSort,
        hideContextMenu,
      },
    } = this.props;

    let reverse = false;
    if (field !== null && sortField === field) {
      reverse = !sortReverse;
    }

    setSort(SORT_KEY, field, reverse);
    hideContextMenu();
  }

  renderView = () => {
    const {
      sortField,
      sortReverse,
      view,
      loading_progress,
      playlists: playlistsProp,
    } = this.props;
    const {
      filter,
    } = this.state;

    if (loading_progress) {
      return <Loader body loading progress={loading_progress} />;
    }
    let playlists = [...playlistsProp];

    if (sortField) {
      playlists = sortItems(playlists, sortField, sortReverse);
    }
    playlists = removeDuplicates(playlists);

    if (filter !== '') {
      playlists = applyFilter('name', filter, playlists);
    }

    if (view === 'list') {
      return (
        <section className="content-wrapper">
          <List
            items={playlists}
            thumbnail
            details={['owner', 'tracks', 'last_modified']}
            right_column={['source']}
          />
        </section>
      );
    }
    return (
      <section className="content-wrapper">
        <Grid items={playlists} />
      </section>
    );
  }

  render = () => {
    const {
      uiActions,
      providers,
      source,
      sortField,
      sortReverse,
      view,
      loading_progress,
    } = this.props;
    const {
      filter,
    } = this.state;

    const view_options = [
      {
        value: 'thumbnails',
        label: i18n('fields.filters.thumbnails'),
      },
      {
        value: 'list',
        label: i18n('fields.filters.list'),
      },
    ];

    const sort_options = [
      {
        value: null,
        label: i18n('fields.filters.as_loaded'),
      },
      {
        value: 'name',
        label: i18n('fields.filters.name'),
      },
      {
        value: 'last_modified',
        label: i18n('fields.filters.updated'),
      },
      {
        value: 'can_edit',
        label: i18n('fields.filters.editable'),
      },
      {
        value: 'owner',
        label: i18n('fields.filters.owner'),
      },
      {
        value: 'tracks',
        label: i18n('fields.filters.tracks'),
      },
      {
        value: 'source',
        label: i18n('fields.filters.source'),
      },
    ];

    const options = (
      <>
        <FilterField
          initialValue={filter}
          handleChange={(value) => this.setState({ filter: value })}
          onSubmit={() => uiActions.hideContextMenu()}
        />
        <DropdownField
          icon="swap_vert"
          name={i18n('fields.sort')}
          value={sortField}
          valueAsLabel
          options={sort_options}
          selected_icon={sortField ? (sortReverse ? 'keyboard_arrow_up' : 'keyboard_arrow_down') : null}
          handleChange={this.onSortChange}
        />
        <DropdownField
          icon="visibility"
          name={i18n('fields.view')}
          valueAsLabel
          value={view}
          options={view_options}
          handleChange={(value) => { uiActions.set({ library_playlists_view: value }); uiActions.hideContextMenu(); }}
        />
        <DropdownField
          icon="cloud"
          name={i18n('fields.source')}
          valueAsLabel
          value={source}
          options={[
            {
              value: 'all',
              label: i18n('fields.filters.all'),
            },
            ...providers.map((p) => ({ value: p.uri, label: p.title })),
          ]}
          handleChange={(value) => { uiActions.set({ library_playlists_source: value }); uiActions.hideContextMenu(); }}
        />
        <Button
          noHover
          discrete
          onClick={loading_progress ? this.cancelRefresh : this.refresh}
          tracking={{ category: 'LibraryAlbums', action: 'Refresh' }}
        >
          {loading_progress ? <Icon name="close" /> : <Icon name="refresh" /> }
          {loading_progress ? <I18n path="actions.cancel" /> : <I18n path="actions.refresh" /> }
        </Button>
        <Button
          to="/modal/create-playlist"
          noHover
          discrete
          tracking={{ category: 'Playlist', action: 'Create' }}
        >
          <Icon name="add_box" />
          <I18n path="actions.add" />
        </Button>
      </>
    );

    return (
      <div className="view library-playlists-view">
        <Header options={options} uiActions={uiActions}>
          <Icon name="queue_music" type="material" />
          <I18n path="library.playlists.title" />
        </Header>
        { this.renderView() }
      </div>
    );
  }
}

const librarySelector = makeLibrarySelector('playlists');
const processProgressSelector = makeProcessProgressSelector(processKeys);
const providersSelector = makeProvidersSelector('playlists');
const mapStateToProps = (state) => {
  const {
    spotify: {
      me: {
        id: me_id,
      } = {},
    },
  } = state;
  const [sortField, sortReverse] = getSortSelector(state, SORT_KEY, null);

  return {
    slim_mode: state.ui.slim_mode,
    providers: providersSelector(state),
    playlists: librarySelector(state, 'playlists'),
    loading_progress: processProgressSelector(state),
    source: getLibrarySource(state, 'playlists'),
    me_id,
    view: state.ui.library_playlists_view,
    sortField,
    sortReverse,
  };
};

const mapDispatchToProps = (dispatch) => ({
  coreActions: bindActionCreators(coreActions, dispatch),
  uiActions: bindActionCreators(uiActions, dispatch),
  mopidyActions: bindActionCreators(mopidyActions, dispatch),
  spotifyActions: bindActionCreators(spotifyActions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(Playlists);
