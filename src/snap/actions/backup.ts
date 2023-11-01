import { SnapError, SnapErrorCode } from '../../error';
import { sendMessage } from '../../firebaseEndpoints';
import { BackupConversation, DistributedKey, PairingData } from '../../types';
import { encMessage } from '../entropy';

export const backup = async (
	pairingData: PairingData,
	encryptedMessage: string,
) => {
	try {
		const response = await sendMessage(
			pairingData.token,
			'backup',
			{
				backupData: encryptedMessage,
				pairingId: pairingData.pairingId,
				createdAt: Date.now(),
				expiry: 30000,
			} as BackupConversation,
			false,
		);
		if (response && !response.isBackedUp) {
			throw new SnapError('Backup failed', SnapErrorCode.BackupFailed);
		}
	} catch (error) {
		if (error instanceof SnapError) {
			throw error;
		} else if (error instanceof Error) {
			throw new SnapError(error.message, SnapErrorCode.BackupFailed);
		} else throw new SnapError('unknown-error', SnapErrorCode.UnknownError);
	}
};
