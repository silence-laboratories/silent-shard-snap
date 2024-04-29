import { SnapError, SnapErrorCode } from '../../error';
import { sendMessage } from '../../firebaseApi';

export const setSnapVersion = async (token: string, snapVersion: string) => {
	try {
		await sendMessage(token, 'users', { snapVersion }, false);
	} catch (error) {
		if (error instanceof SnapError) {
			throw error;
		} else if (error instanceof Error) {
			throw new SnapError(error.message, SnapErrorCode.BackupFailed);
		} else throw new SnapError('unknown-error', SnapErrorCode.UnknownError);
	}
};
