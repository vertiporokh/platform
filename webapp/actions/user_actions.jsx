// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PreferenceStore from 'stores/preference_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import {getChannelMembersForUserIds} from 'actions/channel_actions.jsx';
import {loadCurrentLocale, clientLogout} from 'actions/global_actions.jsx';
import {loadStatusesForProfilesList, loadStatusesForProfilesMap} from 'actions/status_actions.jsx';

import {getDirectChannelName, getUserIdFromChannelName} from 'utils/utils.jsx';

import Client from 'client/web_client.jsx';

import {Constants, ActionTypes, Preferences} from 'utils/constants.jsx';
import {browserHistory} from 'react-router/es6';

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import * as Selectors from 'mattermost-redux/selectors/entities/users';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import * as UserActions from 'mattermost-redux/actions/users';

import {getClientConfig, getLicenseConfig} from 'mattermost-redux/actions/general';
import {getTeamMembersByIds, getMyTeamMembers, getMyTeamUnreads} from 'mattermost-redux/actions/teams';
import {getChannelAndMyMember} from 'mattermost-redux/actions/channels';
import {savePreferences, deletePreferences} from 'mattermost-redux/actions/preferences';

import {Preferences as PreferencesRedux} from 'mattermost-redux/constants';

export function loadMe(callback) {
    UserActions.loadMe()(dispatch, getState).then(
        () => {
            loadCurrentLocale();

            if (callback) {
                callback();
            }
        }
    );
}

export function loadMeAndConfig(callback) {
    loadMe(() => {
        getClientConfig()(store.dispatch, store.getState).then(
            (config) => {
                global.window.mm_config = config;

                if (global.window && global.window.analytics) {
                    global.window.analytics.identify(global.window.mm_config.DiagnosticId, {}, {
                        context: {
                            ip: '0.0.0.0'
                        },
                        page: {
                            path: '',
                            referrer: '',
                            search: '',
                            title: '',
                            url: ''
                        },
                        anonymousId: '00000000000000000000000000'
                    });
                }

                getLicenseConfig()(store.dispatch, store.getState).then(
                    (license) => { // eslint-disable-line max-nested-callbacks
                        global.window.mm_license = license;

                        if (callback) {
                            callback();
                        }
                    }
                );
            }
        );
    });
}

export function switchFromLdapToEmail(email, password, token, ldapPassword, success, error) {
    UserActions.switchLdapToEmail(ldapPassword, email, password, token)(dispatch, getState).then(
        (data) => {
            if (data) {
                if (data.follow_link) {
                    clientLogout(data.follow_link);
                }
                if (success) {
                    success(data);
                }
            } else if (data == null && error) {
                const serverError = getState().requests.users.switchLogin.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function loadProfilesAndTeamMembers(page, perPage, teamId = TeamStore.getCurrentId(), success) {
    UserActions.getProfilesInTeam(teamId, page, perPage)(dispatch, getState).then(
        (data) => {
            loadTeamMembersForProfilesList(data, teamId, success);
            loadStatusesForProfilesList(data);
        }
    );
}

export function loadProfilesAndTeamMembersAndChannelMembers(page, perPage, teamId = TeamStore.getCurrentId(), channelId = ChannelStore.getCurrentId(), success, error) {
    UserActions.getProfilesInChannel(channelId, page, perPage)(dispatch, getState).then(
        (data) => {
            loadTeamMembersForProfilesList(
                data,
                teamId,
                () => {
                    loadChannelMembersForProfilesList(data, channelId, success, error);
                    loadStatusesForProfilesList(data);
                }
            );
        }
    );
}

export function loadTeamMembersForProfilesList(profiles, teamId = TeamStore.getCurrentId(), success, error) {
    const membersToLoad = {};
    for (let i = 0; i < profiles.length; i++) {
        const pid = profiles[i].id;

        if (!TeamStore.hasActiveMemberInTeam(teamId, pid)) {
            membersToLoad[pid] = true;
        }
    }

    const list = Object.keys(membersToLoad);
    if (list.length === 0) {
        if (success) {
            success({});
        }
        return;
    }

    loadTeamMembersForProfiles(list, teamId, success, error);
}

export function loadProfilesWithoutTeam(page, perPage, success) {
    UserActions.getProfilesWithoutTeam(page, perPage)(dispatch, getState).then(
        (data) => {
            loadStatusesForProfilesMap(data);

            if (success) {
                success(data);
            }
        }
    );
}

function loadTeamMembersForProfiles(userIds, teamId, success, error) {
    getTeamMembersByIds(teamId, userIds)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.teams.getTeamMembers.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function loadChannelMembersForProfilesMap(profiles, channelId = ChannelStore.getCurrentId(), success, error) {
    const membersToLoad = {};
    for (const pid in profiles) {
        if (!profiles.hasOwnProperty(pid)) {
            continue;
        }

        if (!ChannelStore.hasActiveMemberInChannel(channelId, pid)) {
            membersToLoad[pid] = true;
        }
    }

    const list = Object.keys(membersToLoad);
    if (list.length === 0) {
        if (success) {
            success({});
        }
        return;
    }

    getChannelMembersForUserIds(channelId, list, success, error);
}

export function loadTeamMembersAndChannelMembersForProfilesList(profiles, teamId = TeamStore.getCurrentId(), channelId = ChannelStore.getCurrentId(), success, error) {
    loadTeamMembersForProfilesList(profiles, teamId, () => {
        loadChannelMembersForProfilesList(profiles, channelId, success, error);
    }, error);
}

export function loadChannelMembersForProfilesList(profiles, channelId = ChannelStore.getCurrentId(), success, error) {
    const membersToLoad = {};
    for (let i = 0; i < profiles.length; i++) {
        const pid = profiles[i].id;

        if (!ChannelStore.hasActiveMemberInChannel(channelId, pid)) {
            membersToLoad[pid] = true;
        }
    }

    const list = Object.keys(membersToLoad);
    if (list.length === 0) {
        if (success) {
            success({});
        }
        return;
    }

    getChannelMembersForUserIds(channelId, list, success, error);
}

function populateDMChannelsWithProfiles(userIds) {
    const currentUserId = UserStore.getCurrentId();

    for (let i = 0; i < userIds.length; i++) {
        const channelName = getDirectChannelName(currentUserId, userIds[i]);
        const channel = ChannelStore.getByName(channelName);
        const profilesInChannel = Selectors.getUserIdsInChannels(getState())[channel.id] || new Set();
        if (channel && !profilesInChannel.has(userIds[i])) {
            UserStore.saveUserIdInChannel(channel.id, userIds[i]);
        }
    }
}

function populateChannelWithProfiles(channelId, users) {
    for (let i = 0; i < users.length; i++) {
        UserStore.saveUserIdInChannel(channelId, users[i].id);
    }
    UserStore.emitInChannelChange();
}

export function loadNewDMIfNeeded(channelId) {
    function checkPreference(channel) {
        const userId = getUserIdFromChannelName(channel);

        if (!userId) {
            return;
        }

        const pref = PreferenceStore.getBool(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, userId, false);
        if (pref === false) {
            PreferenceStore.setPreference(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, userId, 'true');
            const currentUserId = UserStore.getCurrentId();
            savePreferences(currentUserId, [{user_id: currentUserId, category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, name: userId, value: 'true'}])(dispatch, getState);
            loadProfilesForDM();
        }
    }

    const channel = ChannelStore.get(channelId);
    if (channel) {
        checkPreference(channel);
    } else {
        getChannelAndMyMember(channelId)(dispatch, getState).then(
            (data) => {
                if (data) {
                    checkPreference(data.channel);
                }
            }
        );
    }
}

export function loadNewGMIfNeeded(channelId) {
    function checkPreference() {
        const pref = PreferenceStore.getBool(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, channelId, false);
        if (pref === false) {
            PreferenceStore.setPreference(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, channelId, 'true');
            const currentUserId = UserStore.getCurrentId();
            savePreferences(currentUserId, [{user_id: currentUserId, category: Preferences.CATEGORY_GROUP_CHANNEL_SHOW, name: channelId, value: 'true'}])(dispatch, getState);
            loadProfilesForGM();
        }
    }

    const channel = ChannelStore.get(channelId);
    if (channel) {
        checkPreference();
    } else {
        getChannelAndMyMember(channelId)(dispatch, getState).then(
            () => {
                checkPreference();
            }
        );
    }
}

export function loadProfilesForSidebar() {
    loadProfilesForDM();
    loadProfilesForGM();
}

export function loadProfilesForGM() {
    const channels = ChannelStore.getChannels();
    const newPreferences = [];

    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        if (channel.type !== Constants.GM_CHANNEL) {
            continue;
        }

        if (UserStore.getProfileListInChannel(channel.id).length >= Constants.MIN_USERS_IN_GM) {
            continue;
        }

        const isVisible = PreferenceStore.getBool(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, channel.id);

        if (!isVisible) {
            const member = ChannelStore.getMyMember(channel.id);
            if (!member || (member.mention_count === 0 && member.msg_count >= channel.total_msg_count)) {
                continue;
            }

            newPreferences.push({
                user_id: UserStore.getCurrentId(),
                category: Preferences.CATEGORY_GROUP_CHANNEL_SHOW,
                name: channel.id,
                value: 'true'
            });
        }

        UserActions.getProfilesInChannel(channel.id, 0, Constants.MAX_USERS_IN_GM)(dispatch, getState).then(
            (data) => {
                populateChannelWithProfiles(channel.id, data);
            }
        );
    }

    if (newPreferences.length > 0) {
        const currentUserId = UserStore.getCurrentId();
        savePreferences(currentUserId, newPreferences)(dispatch, getState);
    }
}

export function loadProfilesForDM() {
    const channels = ChannelStore.getChannels();
    const newPreferences = [];
    const profilesToLoad = [];
    const profileIds = [];

    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        if (channel.type !== Constants.DM_CHANNEL) {
            continue;
        }

        const teammateId = channel.name.replace(UserStore.getCurrentId(), '').replace('__', '');
        const isVisible = PreferenceStore.getBool(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, teammateId);

        if (!isVisible) {
            const member = ChannelStore.getMyMember(channel.id);
            if (!member || member.mention_count === 0) {
                continue;
            }

            newPreferences.push({
                user_id: UserStore.getCurrentId(),
                category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW,
                name: teammateId,
                value: 'true'
            });
        }

        if (!UserStore.hasProfile(teammateId)) {
            profilesToLoad.push(teammateId);
        }
        profileIds.push(teammateId);
    }

    if (newPreferences.length > 0) {
        const currentUserId = UserStore.getCurrentId();
        savePreferences(currentUserId, newPreferences)(dispatch, getState);
    }

    if (profilesToLoad.length > 0) {
        UserActions.getProfilesByIds(profilesToLoad)(dispatch, getState).then(
            () => {
                populateDMChannelsWithProfiles(profileIds);
            },
        );
    } else {
        populateDMChannelsWithProfiles(profileIds);
    }
}

export function saveTheme(teamId, theme, onSuccess, onError) {
    const currentUserId = UserStore.getCurrentId();
    savePreferences(currentUserId, [{
        user_id: currentUserId,
        category: Preferences.CATEGORY_THEME,
        name: teamId,
        value: JSON.stringify(theme)
    }])(dispatch, getState).then(
        (data) => {
            if (data && onSuccess) {
                onThemeSaved(teamId, theme, onSuccess);
            } else if (data == null && onError) {
                const serverError = getState().requests.users.savePreferences.error;
                onError({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

function onThemeSaved(teamId, theme, onSuccess) {
    const themePreferences = PreferenceStore.getCategory(Preferences.CATEGORY_THEME);

    if (teamId !== '' && themePreferences.size > 1) {
        // no extra handling to be done to delete team-specific themes
        onSuccess();
        return;
    }

    const toDelete = [];

    for (const [name] of themePreferences) {
        if (name === '' || name === teamId) {
            continue;
        }

        toDelete.push({
            user_id: UserStore.getCurrentId(),
            category: Preferences.CATEGORY_THEME,
            name
        });
    }

    if (toDelete.length > 0) {
        // we're saving a new global theme so delete any team-specific ones
        const currentUserId = UserStore.getCurrentId();
        deletePreferences(currentUserId, toDelete)(dispatch, getState);
    }

    onSuccess();
}

export function searchUsers(term, teamId = TeamStore.getCurrentId(), options = {}, success) {
    UserActions.searchProfiles(term, {team_id: teamId, ...options})(dispatch, getState).then(
        (data) => {
            loadStatusesForProfilesList(data);

            if (success) {
                success(data);
            }
        }
    );
}

export function searchUsersNotInTeam(term, teamId = TeamStore.getCurrentId(), options = {}, success) {
    UserActions.searchProfiles(term, {not_in_team_id: teamId, ...options})(dispatch, getState).then(
        (data) => {
            loadStatusesForProfilesList(data);

            if (success) {
                success(data);
            }
        }
    );
}

export function autocompleteUsersInChannel(username, channelId, success) {
    const channel = ChannelStore.get(channelId);
    const teamId = channel ? channel.team_id : TeamStore.getCurrentId();
    UserActions.autocompleteRedux(username, teamId, channelId)(dispatch, getState).then(
        (data) => {
            if (success) {
                success(data);
            }
        }
    );
}

export function autocompleteUsersInTeam(username, success) {
    UserActions.autocompleteRedux(username, TeamStore.getCurrentId())(dispatch, getState).then(
        (data) => {
            if (success) {
                success(data);
            }
        }
    );
}

export function autocompleteUsers(username, success) {
    UserActions.autocompleteRedux(username)(dispatch, getState).then(
        (data) => {
            if (success) {
                success(data);
            }
        }
    );
}

export function updateUser(user, type, success, error) {
    UserActions.updateMe(user)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.updateMe.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function generateMfaSecret(success, error) {
    UserActions.generateMfaSecret()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.generateMfaSecret.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function updateUserNotifyProps(props, success, error) {
    UserActions.updateMe({notify_props: props})(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.updateMe.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function updateUserRoles(userId, newRoles, success, error) {
    UserActions.updateUserRolesRedux(userId, newRoles)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.updateUser.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function activateMfa(code, success, error) {
    UserActions.updateUserMfa(UserStore.getCurrentId(), true, code)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.updateUser.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        },
    );
}

export function deactivateMfa(success, error) {
    UserActions.updateUserMfa(UserStore.getCurrentId(), false)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.updateUser.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        },
    );
}

export function checkMfa(loginId, success, error) {
    if (global.window.mm_config.EnableMultifactorAuthentication !== 'true') {
        success(false);
        return;
    }

    UserActions.checkMfaRedux(loginId)(dispatch, getState).then(
        (data) => {
            if (data != null && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.checkMfa.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function updateActive(userId, active, success, error) {
    UserActions.updateUserActive(userId, active)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.updateUser.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function updatePassword(userId, currentPassword, newPassword, success, error) {
    UserActions.updateUserPassword(userId, currentPassword, newPassword)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.updateUser.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function verifyEmail(token, success, error) {
    UserActions.verifyUserEmail(token)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.verifyEmail.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function resetPassword(token, password, success, error) {
    UserActions.resetUserPassword(token, password)(dispatch, getState).then(
        (data) => {
            if (data) {
                browserHistory.push('/login?extra=' + ActionTypes.PASSWORD_CHANGE);
                if (success) {
                    success(data);
                }
            } else if (data == null && error) {
                const serverError = getState().requests.users.passwordReset.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function resendVerification(email, success, error) {
    UserActions.sendVerificationEmail(email)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.verifyEmail.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function loginById(userId, password, mfaToken, success, error) {
    UserActions.loginById(userId, password, mfaToken)(dispatch, getState).then(
        (ok) => {
            if (ok && success) {
                success();
            } else if (!ok && error) {
                const serverError = getState().requests.users.login.error;
                if (serverError.server_error_id === 'api.context.mfa_required.app_error') {
                    if (success) {
                        success();
                    }
                    return;
                }
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function createUserWithInvite(user, data, emailHash, inviteId, success, error) {
    UserActions.createUser(user, data, emailHash, inviteId)(dispatch, getState).then(
        (resp) => {
            if (resp && success) {
                success(resp);
            } else if (resp == null && error) {
                const serverError = getState().requests.users.create.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function webLogin(loginId, password, token, success, error) {
    UserActions.login(loginId, password, token)(dispatch, getState).then(
        (ok) => {
            if (ok && success) {
                success();
            } else if (!ok && error) {
                const serverError = getState().requests.users.login.error;
                if (serverError.server_error_id === 'api.context.mfa_required.app_error') {
                    if (success) {
                        success();
                    }
                    return;
                }
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function webLoginByLdap(loginId, password, token, success, error) {
    UserActions.login(loginId, password, token, true)(dispatch, getState).then(
        (ok) => {
            if (ok && success) {
                success();
            } else if (!ok && error) {
                const serverError = getState().requests.users.login.error;
                if (serverError.server_error_id === 'api.context.mfa_required.app_error') {
                    if (success) {
                        success();
                    }
                    return;
                }
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function getAuthorizedApps(success, error) {
    Client.getAuthorizedApps(
        (authorizedApps) => {
            if (success) {
                success(authorizedApps);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        });
}

export function deauthorizeOAuthApp(appId, success, error) {
    Client.deauthorizeOAuthApp(
        appId,
        () => {
            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        });
}

export function uploadProfileImage(userPicture, success, error) {
    UserActions.uploadProfileImage(Selectors.getCurrentUserId(getState()), userPicture)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.updateUser.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function loadProfiles(page, perPage, success) {
    UserActions.getProfiles(page, perPage)(dispatch, getState).then(
        (data) => {
            if (success) {
                success(data);
            }
        }
    );
}

export function getMissingProfiles(ids) {
    const missingIds = ids.filter((id) => !UserStore.hasProfile(id));

    if (missingIds.length === 0) {
        return;
    }

    UserActions.getProfilesByIds(missingIds)(dispatch, getState);
}

export function loadMyTeamMembers() {
    getMyTeamMembers()(dispatch, getState).then(
        () => {
            getMyTeamUnreads()(dispatch, getState);
        }
    );
}

export function autoResetStatus() {
    return async (doDispatch, doGetState) => {
        const {currentUserId} = getState().entities.users;
        const userStatus = await UserActions.getStatus(currentUserId)(doDispatch, doGetState);

        if (!userStatus.manual) {
            return userStatus;
        }

        const autoReset = getBool(getState(), PreferencesRedux.CATEGORY_AUTO_RESET_MANUAL_STATUS, currentUserId, false);

        if (autoReset) {
            UserActions.setStatus({user_id: currentUserId, status: 'online'})(doDispatch, doGetState);
            return userStatus;
        }

        return userStatus;
    };
}
