// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

import * as Emoji from 'utils/emoji.jsx';
import EmojiStore from 'stores/emoji_store.jsx';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import * as Utils from 'utils/utils.jsx';
import {FormattedMessage} from 'react-intl';

import EmojiPickerCategory from './components/emoji_picker_category.jsx';
import EmojiPickerItem from './components/emoji_picker_item.jsx';
import EmojiPickerPreview from './components/emoji_picker_preview.jsx';

// This should include all the categories available in Emoji.CategoryNames
const CATEGORIES = [
    'recent',
    'people',
    'nature',
    'food',
    'activity',
    'travel',
    'objects',
    'symbols',
    'flags',
    'custom'
];

export default class EmojiPicker extends React.Component {
    static propTypes = {
        style: PropTypes.object,
        rightOffset: PropTypes.number,
        topOffset: PropTypes.number,
        placement: PropTypes.oneOf(['top', 'bottom', 'left']),
        customEmojis: PropTypes.object,
        onEmojiClick: PropTypes.func.isRequired
    }

    static defaultProps = {
        rightOffset: 0,
        topOffset: 0
    };

    constructor(props) {
        super(props);

        // All props are primitives or treated as immutable
        this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);

        this.handleCategoryClick = this.handleCategoryClick.bind(this);
        this.handleFilterChange = this.handleFilterChange.bind(this);
        this.handleItemOver = this.handleItemOver.bind(this);
        this.handleItemOut = this.handleItemOut.bind(this);
        this.handleItemClick = this.handleItemClick.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.handleItemUnmount = this.handleItemUnmount.bind(this);
        this.renderCategory = this.renderCategory.bind(this);

        this.state = {
            category: 'recent',
            filter: '',
            selected: null
        };
    }

    componentDidMount() {
        // Delay taking focus because this briefly renders offscreen when using an Overlay
        // so focusing it immediately on mount can cause weird scrolling
        requestAnimationFrame(() => {
            this.searchInput.focus();
        });
    }

    handleCategoryClick(category) {
        const items = this.refs.items;

        if (category === CATEGORIES[0]) {
            // First category includes the search box so just scroll to the top
            items.scrollTop = 0;
        } else {
            const cat = this.refs[category];
            items.scrollTop = cat.offsetTop;
        }
    }

    handleFilterChange(e) {
        this.setState({filter: e.target.value});
    }

    handleItemOver(emoji) {
        clearTimeout(this.timeouthandler);
        this.setState({selected: emoji});
    }

    handleItemOut() {
        this.timeouthandler = setTimeout(() => this.setState({selected: null}), 500);
    }

    handleItemUnmount(emoji) {
        // Prevent emoji preview from showing emoji which is not present anymore (due to filter)
        if (this.state.selected === emoji) {
            this.setState({selected: null});
        }
    }

    handleItemClick(emoji) {
        this.props.onEmojiClick(emoji);
    }

    handleScroll() {
        const items = this.refs.items;
        const contentTop = items.scrollTop;
        const itemsPaddingTop = getComputedStyle(items).paddingTop;
        const contentTopPadding = parseInt(itemsPaddingTop, 10);
        const scrollPct = (contentTop / (items.scrollHeight - items.clientHeight)) * 100.0;

        if (scrollPct > 99.0) {
            this.setState({category: 'custom'});
            return;
        }

        for (const category of CATEGORIES) {
            const header = this.refs[category];
            const headerStyle = getComputedStyle(header);
            const headerBottomMargin = parseInt(headerStyle.marginBottom, 10);
            const headerBottomPadding = parseInt(headerStyle.paddingBottom, 10);
            const headerBottomSpace = headerBottomMargin + headerBottomPadding;
            const headerBottom = header.offsetTop + header.offsetHeight + headerBottomSpace;

            // If category is the first one visible, highlight it in the bar at the top
            if (headerBottom - contentTopPadding >= contentTop) {
                if (this.state.category !== category) {
                    this.setState({category: String(category)});
                }

                break;
            }
        }
    }
    renderCategory(category, filter) {
        const items = [];
        let indices = [];
        let recentEmojis = [];

        if (category === 'recent') {
            recentEmojis = EmojiStore.getRecentEmojis();
            indices = [...Array(recentEmojis.length).keys()];

            // reverse indices so most recently added is first
            indices.reverse();
        } else {
            indices = Emoji.EmojiIndicesByCategory.get(category) || [];
        }

        for (const index of indices) {
            let emoji = {};
            if (category === 'recent') {
                emoji = recentEmojis[index];
            } else {
                emoji = Emoji.Emojis[index];
            }
            if (filter) {
                let matches = false;

                for (const alias of emoji.aliases || [...emoji.name]) {
                    if (alias.indexOf(filter) !== -1) {
                        matches = true;
                        break;
                    }
                }

                if (!matches) {
                    continue;
                }
            }

            items.push(
                <EmojiPickerItem
                    key={'system_' + (category === 'recent' ? 'recent_' : '') + (emoji.name || emoji.aliases[0])}
                    emoji={emoji}
                    category={category}
                    onItemOver={this.handleItemOver}
                    onItemOut={this.handleItemOut}
                    onItemClick={this.handleItemClick}
                    onItemUnmount={this.handleItemUnmount}
                />
            );
        }

        if (category === 'custom') {
            const customEmojis = EmojiStore.getCustomEmojiMap().values();

            for (const emoji of customEmojis) {
                if (filter && emoji.name.indexOf(filter) === -1) {
                    continue;
                }

                items.push(
                    <EmojiPickerItem
                        key={'custom_' + emoji.name}
                        emoji={emoji}
                        category={category}
                        onItemOver={this.handleItemOver}
                        onItemOut={this.handleItemOut}
                        onItemClick={this.handleItemClick}
                        onItemUnmount={this.handleItemUnmount}

                    />
                );
            }
        }

        // Only render the header if there's any visible items
        let header = null;
        if (items.length > 0) {
            header = (
                <div
                    className='emoji-picker__category-header'
                >
                    <FormattedMessage id={'emoji_picker.' + category}/>
                </div>
            );
        }

        return (
            <div
                key={'category_' + category}
                id={'emojipickercat-' + category}
                ref={category}
            >
                {header}
                <div className='emoji-picker-items__container'>
                    {items}
                </div>
            </div>
        );
    }

    renderPreview(selected) {
        if (selected) {
            let name;
            let aliases;
            let previewImage;
            if (selected.name) {
                // This is a custom emoji that matches the model on the server
                name = selected.name;
                aliases = [selected.name];
                previewImage = (
                    <img
                        className='emoji-picker__preview-image'
                        align='absmiddle'
                        src={EmojiStore.getEmojiImageUrl(selected)}
                    />
                );
            } else {
                // This is a system emoji which only has a list of aliases
                name = selected.aliases[0];
                aliases = selected.aliases;
                previewImage = (
                    <span>
                        <img
                            src='/static/emoji/img_trans.gif'
                            className={'  emojisprite-preview emoji-' + selected.filename + ' '}
                            align='absmiddle'
                        />
                    </span>
                );
            }

            return (
                <div className='emoji-picker__preview'>
                    {previewImage}
                    <span className='emoji-picker__preview-name'>{name}</span>
                    <span className='emoji-picker__preview-aliases'>{aliases.map((alias) => ':' + alias + ':').join(' ')}</span>
                </div>
            );
        }

        return (
            <span className='emoji-picker__preview-placeholder'>
                <FormattedMessage
                    id='emoji_picker.emojiPicker'
                    defaultMessage='Emoji Picker'
                />
            </span>
        );
    }

    render() {
        const items = [];

        for (const category of CATEGORIES) {
            if (category === 'custom') {
                items.push(this.renderCategory('custom', this.state.filter, this.props.customEmojis));
            } else {
                items.push(this.renderCategory(category, this.state.filter));
            }
        }

        let pickerStyle;
        if (this.props.style && !(this.props.style.left === 0 || this.props.style.top === 0)) {
            if (this.props.placement === 'top' || this.props.placement === 'bottom') {
                // Only take the top/bottom position passed by React Bootstrap since we want to be right-aligned
                pickerStyle = {
                    top: this.props.style.top,
                    bottom: this.props.style.bottom,
                    right: this.props.rightOffset
                };
            } else {
                pickerStyle = {...this.props.style};
            }
        }

        if (pickerStyle && pickerStyle.top) {
            pickerStyle.top += this.props.topOffset;
        }

        return (
            <div
                className='emoji-picker'
                style={pickerStyle}
            >
                <div className='emoji-picker__categories'>
                    <EmojiPickerCategory
                        category='recent'
                        icon={
                            <i
                                className='fa fa-clock-o'
                                title={Utils.localizeMessage('emoji_picker.recent', 'Recently Used')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'recent'}
                    />
                    <EmojiPickerCategory
                        category='people'
                        icon={
                            <i
                                className='fa fa-smile-o'
                                title={Utils.localizeMessage('emoji_picker.people', 'People')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'people'}
                    />
                    <EmojiPickerCategory
                        category='nature'
                        icon={
                            <i
                                className='fa fa-leaf'
                                title={Utils.localizeMessage('emoji_picker.nature', 'Nature')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'nature'}
                    />
                    <EmojiPickerCategory
                        category='food'
                        icon={
                            <i
                                className='fa fa-cutlery'
                                title={Utils.localizeMessage('emoji_picker.food', 'Food')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'food'}
                    />
                    <EmojiPickerCategory
                        category='activity'
                        icon={
                            <i
                                className='fa fa-futbol-o'
                                title={Utils.localizeMessage('emoji_picker.activity', 'Activity')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'activity'}
                    />
                    <EmojiPickerCategory
                        category='travel'
                        icon={
                            <i
                                className='fa fa-plane'
                                title={Utils.localizeMessage('emoji_picker.travel', 'Travel')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'travel'}
                    />
                    <EmojiPickerCategory
                        category='objects'
                        icon={
                            <i
                                className='fa fa-lightbulb-o'
                                title={Utils.localizeMessage('emoji_picker.objects', 'Objects')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'objects'}
                    />
                    <EmojiPickerCategory
                        category='symbols'
                        icon={
                            <i
                                className='fa fa-heart-o'
                                title={Utils.localizeMessage('emoji_picker.symbols', 'Symbols')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'symbols'}
                    />
                    <EmojiPickerCategory
                        category='flags'
                        icon={
                            <i
                                className='fa fa-flag-o'
                                title={Utils.localizeMessage('emoji_picker.flags', 'Flags')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'flags'}
                    />
                    <EmojiPickerCategory
                        category='custom'
                        icon={
                            <i
                                className='fa fa-at'
                                title={Utils.localizeMessage('emoji_picker.custom', 'Custom')}
                            />
                        }
                        onCategoryClick={this.handleCategoryClick}
                        selected={this.state.category === 'custom'}
                    />
                </div>
                <div className='emoji-picker__search-container'>
                    <span className='fa fa-search emoji-picker__search-icon'/>
                    <input
                        ref={(input) => {
                            this.searchInput = input;
                        }}
                        className='emoji-picker__search'
                        type='text'
                        onChange={this.handleFilterChange}
                        placeholder={Utils.localizeMessage('emoji_picker.search', 'search')}
                    />
                </div>
                <div
                    ref='items'
                    id='emojipickeritems'
                    className='emoji-picker__items'
                    onScroll={this.handleScroll}
                >
                    {items}
                </div>
                <EmojiPickerPreview emoji={this.state.selected}/>
            </div>
        );
    }
}
