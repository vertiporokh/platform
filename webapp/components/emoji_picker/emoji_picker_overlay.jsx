// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {Overlay} from 'react-bootstrap';

import EmojiPicker from './emoji_picker.jsx';

export default class EmojiPickerOverlay extends React.PureComponent {
    static propTypes = {
        show: PropTypes.bool.isRequired,
        container: PropTypes.func,
        target: PropTypes.func.isRequired,
        onEmojiClick: PropTypes.func.isRequired,
        onHide: PropTypes.func.isRequired
    }

    constructor(props) {
        super(props);

        this.state = {
            placement: 'top'
        };
    }

    componentWillUpdate(nextProps) {
        if (nextProps.show && !this.props.show) {
            const spaceRequiredAbove = 422;
            const spaceRequiredBelow = 436;

            const targetBounds = nextProps.target().getBoundingClientRect();

            let placement;
            if (targetBounds.top > spaceRequiredAbove) {
                placement = 'top';
            } else if (window.innerHeight - targetBounds.bottom > spaceRequiredBelow) {
                placement = 'bottom';
            } else {
                placement = 'left';
            }

            this.setState({placement});
        }
    }

    render() {
        return (
            <Overlay
                show={this.props.show}
                placement={this.state.placement}
                rootClose={true}
                container={this.props.container}
                onHide={this.props.onHide}
                target={this.props.target}
                animation={false}
            >
                <EmojiPicker onEmojiClick={this.props.onEmojiClick}/>
            </Overlay>
        );
    }
}
