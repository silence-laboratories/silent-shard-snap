import { SnapError, SnapErrorCode } from '../../error';
import { sendMessage } from '../../firebaseEndpoints';
import { DistributedKey, PairingData } from '../../types';
import { encMessage } from '../entropy';

export const backup = async (
	pairingData: PairingData,
	distributedKeys: DistributedKey[],
) => {
	try {
		const encryptedMessage = await encMessage(JSON.stringify(distributedKeys));
		const response = await sendMessage(
			pairingData.token,
			'backup',
			{ backup_data: encryptedMessage, is_backed_up: null,  pairing_id: pairingData.pairing_id  },
			false,
		);
		if (response && !response.is_backed_up) {
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
