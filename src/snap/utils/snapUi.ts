// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import { panel, text, heading, divider } from '@metamask/snaps-ui';
import { DialogType } from '@metamask/snaps-types';

const showConfirmationMessage = async (
  prompt: string,
  description: string[],
) => {
  return await snap.request({
    method: 'snap_dialog',
    params: {
      type: DialogType.Confirmation,
      content: panel([
        heading(prompt),
        divider(),
        ...description.map((t) => text(t)),
      ]),
    },
  });
};

export const initPairingConfirmation = async () => {
  return await showConfirmationMessage(
    `Hey there! 👋🏻 Welcome to Silent Shard Snap – your gateway to distributed-self custody!`,
    [
      '👉🏻 To get started, grab the companion Silent Shard app from either the Apple App Store or Google Play.',
      `👉🏻 Just search for 'Silent Shard' and follow the simple steps to set up your MPC account.`,
      `Happy to have you onboard! 🥳`,
    ],
  );
}