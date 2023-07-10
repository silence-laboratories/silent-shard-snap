import { RLP } from '@ethereumjs/rlp';
import { Buffer } from 'buffer';
import { panel, divider, text, heading } from '@metamask/snaps-ui';

const snapId = `local:${window.location.href}`;

let connectButton = document.getElementById('connect');
let isPairedButton = document.getElementById('is_paired');
// let getAccountsButton = document.getElementById('get_accounts');
let runPairingButton = document.getElementById('run_pairing');
let runRefreshButton = document.getElementById('run_refresh');
let runDKGButton = document.getElementById('create_dkg');
let signRequestButton = document.getElementById('send_sign_request');
let unpairButton = document.getElementById('unpair');
let stopButton = document.getElementById('stop');
let entropyButton = document.getElementById('entropy');

connectButton.onclick = connect;
isPairedButton.onclick = isPaired;
// getAccountsButton.onclick = getAccounts;
runRefreshButton.onclick = runRefresh;
runPairingButton.onclick = runPairing;
runDKGButton.onclick = runDKG;
signRequestButton.onclick = sendSignRequest;
unpairButton.onclick = unpair;
stopButton.onclick = stop;
entropyButton.onclick = entropy;

function delay(ms) {
	return new Promise((_) => setTimeout(_, ms));
}

let qrcode = new QRious({
	element: document.getElementById('qrcode'),
	size: 0,
});

async function makeQRCode(message) {
	await qrcode.set({
		value: message,
		size: 200,
	});
}

function clearQRCode() {
	qrcode.size = 0;
}

// Here we get permissions to interact with and install the snap
async function connect() {
	const result = await ethereum.request({
		method: 'wallet_requestSnaps',
		params: {
			[snapId]: {},
		},
	});
}

// Check if the user is already paired and has the pairing data store. If not paired return false
async function isPaired() {
	try {
		const response = await ethereum.request({
			method: 'wallet_invokeSnap',
			params: {
				snapId: snapId,
				request: {
					method: 'tss_isPaired',
				},
			},
		});
		console.log(response);
		let msg = 'Is paired: ' + response.is_paired;
		if (response.is_paired) msg += '\nDevice name: ' + response.device_name;
		alert(msg);
	} catch (err) {
		console.error(err);
	}
}

// Need to be paired first, return accounts info array from local storage
async function get_accounts() {
	try {
		let response = await ethereum.request({
			method: 'wallet_invokeSnap',
			params: {
				snapId: snapId,
				request: {
					method: 'tss_getAccounts',
				},
			},
		});
		return response.accounts;
	} catch (err) {
		return [];
	}
}

function removeOptions(selectElement) {
	var i,
		L = selectElement.options.length - 1;
	for (i = L; i >= 0; i--) {
		selectElement.remove(i);
	}
}

async function updateAccounts() {
	const accounts = await get_accounts();
	const accountInfoContainer = document.getElementById('accounts_info');

	while (accountInfoContainer.firstChild) {
		accountInfoContainer.removeChild(accountInfoContainer.firstChild);
	}

	const select = document.getElementById('account_select');
	removeOptions(select);
	for (var i = 0; i < accounts.length; i++) {
		var opt = document.createElement('option');
		opt.value = accounts[i];
		opt.innerHTML = i + 1;
		select.appendChild(opt);
		const p = document.createElement('p');
		p.innerText = i + 1 + ': ' + accounts[i];
		accountInfoContainer.appendChild(p);
	}
}

async function initPairing() {
	const response = await ethereum.request({
		method: 'wallet_invokeSnap',
		params: {
			snapId: snapId,
			request: {
				method: 'tss_initPairing',
			},
		},
	});
	const qr_code = response.qr_code;
	console.log(qr_code);
	return qr_code;
}

async function runRefresh() {
	try {
		const response = await ethereum
			.request({
				method: 'wallet_invokeSnap',
				params: {
					snapId: snapId,
					request: {
						method: 'tss_runRefresh',
					},
				},
			})
			.catch((error) => console.log(error));

		console.log(response);
	} catch (err) {
		console.error(err);
	}
}

async function runPairing() {
	const qrCode = await initPairing();
	await makeQRCode(qrCode);
	const response = await ethereum
		.request({
			method: 'wallet_invokeSnap',
			params: {
				snapId: snapId,
				request: {
					method: 'tss_runPairing',
				},
			},
		})
		.catch((error) => console.log(error));
	await updateAccounts();
	console.log('Pairing response for QR code', response);
	clearQRCode();
}

async function runDKG() {
	try {
		const response = await ethereum
			.request({
				method: 'wallet_invokeSnap',
				params: {
					snapId: snapId,
					request: {
						method: 'tss_runDKG',
					},
				},
			})
			.catch((error) => console.log(error));
		await updateAccounts();
		console.log(response);

		let msg = 'Status: ' + response.status;
		msg += '\nPublic key: ' + response.public_key;
		alert(msg);
	} catch (err) {
		console.error(err);
	}
}

async function sha256(arr) {
	let hash = await crypto.subtle.digest('SHA-256', arr);
	return new Uint8Array(hash);
}

async function sha256d(arr) {
	let first = await sha256(arr);
	return await sha256(first);
}

// async function keccak256(arr) {
// 	crypto.subtle.digest("",arr)
// }

const toHexString = (bytes) =>
	bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

// const utf8ToHexString = (s) =>
// 	{console.log(window)
// 		return Buffer.from(s,'utf-8').toString("hex");
// 	}

const utf8ToHex = (utf8String) => {
	let hexString = '';
	for (let i = 0; i < utf8String.length; i++) {
		const charCode = utf8String.charCodeAt(i);
		const hex = charCode.toString(16).padStart(2, '0');
		hexString += hex;
	}
	return hexString;
};

async function sendSignRequest() {
	let publicKey = document.getElementById('account_select').value;
	let hashAlg = document.getElementById('hash_alg').value;
	let message = document.getElementById('message').value;
	let sign_type = document.getElementById('sign_type').value;

	let messageHash = null;
	const message_bytes = new TextEncoder().encode(message);
	if (hashAlg === 'sha256') {
		messageHash = await sha256(message_bytes);
	} else if (hashAlg === 'sha256d') {
		messageHash = await sha256d(message_bytes);
	} else if (hashAlg === 'keccak256') {
		messageHash = await keccak256(message_bytes);
	} else {
		throw new Error(`No hash algo found`);
	}

	if (messageHash == null) {
		throw new Error('Invalid hash algorithm');
	}
	messageHash = toHexString(messageHash);

	try {
		const response = await ethereum
			.request({
				method: 'wallet_invokeSnap',
				params: {
					snapId: snapId,
					request: {
						method: 'tss_sendSignRequest',
						params: {
							public_key: publicKey,
							hash_alg: hashAlg,
							message: utf8ToHex(message),
							message_hash: messageHash,
							sign_metadata: sign_type,
						},
					},
				},
			})
			.catch((error) => console.log(error));
		console.log('Sign response:', response);
	} catch (err) {
		console.error(err);
	}
}

async function unpair() {
	try {
		const response = await ethereum.request({
			method: 'wallet_invokeSnap',
			params: {
				snapId: snapId,
				request: {
					method: 'tss_unpair',
				},
			},
		});
		updateAccounts();
		alert('Unpaired');
	} catch (err) {
		console.error(err);
	}
}

async function stop() {
	try {
		const response = await ethereum.request({
			method: 'wallet_invokeSnap',
			params: {
				snapId: snapId,
				request: {
					method: 'tss_stop',
				},
			},
		});
		alert('Stopped');
	} catch (err) {
		console.error(err);
	}
}

async function entropy() {
	try {
		const entropy = await window.ethereum.request({
			method: 'wallet_invokeSnap',
			params: {
				snapId: snapId,
				request: {
					method: 'tss_entropy',
				},
			},
		});
		console.log(entropy);
	} catch (err) {
		console.error(err);
	}
}
(async () => {
	await updateAccounts();
})();
