import { SnapError, SnapErrorCode } from '../../error';
import { sendMessage } from '../../firebaseApi';

export const setSnapVersion = async (token: string, addressSnapVersionObject: { [key: string]: string }) => {
	try {
		await sendMessage(token, 'users', addressSnapVersionObject, false);
	} catch (error) {
		if (error instanceof SnapError) {
			throw error;
		} else if (error instanceof Error) {
			throw new SnapError(error.message, SnapErrorCode.BackupFailed);
		} else throw new SnapError('unknown-error', SnapErrorCode.UnknownError);
	}
};
