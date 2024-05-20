# Silent Shard Snap

The Silent Shard Snap aims to remove single points of failure pertaining to handling of private keys and seed phrases i.e., in current designs of wallets the private keys are stored at a single location- the local storage of the browsers.

Users have been losing access to wallets’ accounts and associated services due to phishing scams and private key theft through associated attack vector for years. This has resulted in loss of approximately USD $14 billion in 2021 alone, a blot in the face of self-sovereign non-custodial wallets which is one of the core tenets of crypto. The Silent Snap Shard aims to remove this entirely with our MPC SDK for {2,2} TSS.

Using Snap, allows us to prove how Multi-Party Computation-based signature schemes can be built at the core of wallets like MetaMask. Users will be able to get access to any WebApps using MetaMask as one shard node wherein Snap provides a way to extend MetaMask’s functionality- provide DAapps with JSON-RPC API methods for MPC supported signatures. Essentially, the snap comprises of the core threshold signature functions and WebApps would be provided with functionality to make necessary calls and handling UI elements.

## How to run

-   Use node version 18 or greater.
-   Now run, `yarn install`, to install the libraries
-   Run, `yarn start` to run snap on local environment. This also have fast refresh so no need to build snap again after changes.

## How to build

- Run `yarn build` or `yarn build:prod` for build production Snap
- Run `yarn build:stg` for build staging Snap

## How to publish

### Pre-publish
-   Run `yarn prepublish:stg` or `yarn prepublish:prod` to update correct metadata for `package.json` and bundle the Snap with right `snap.config` file.
-   Update the version of snap in `package.json`.
-   Update the version in firebase function in `snapVersion.ts` file.

### Publish
-   To publish the snap run `npm publish`. You will need to login with valid npm account before deploying new version. If you encounter any issue, delete the .npmrc and try again.

## How to test

- Use [Snap Jest preset](https://github.com/MetaMask/snaps/tree/main/packages/snaps-jest) for e2e tests.
- Run `yarn test` or `yarn test --coverage` to see test result and coverage.
- While you see this warning `@firebase/firestore: Firestore (9.23.0): GrpcConnection RPC 'Listen' stream 0x1ce2204b error. Code: 1 Message: 1 CANCELLED: Disconnecting idle stream. Timed out waiting for new targets.` after running the test, its due to: https://github.com/jestjs/jest/issues/11464 

## How to give force update for snap
Update the minimum snap version required in firebase remote config ([Firebase remote config](https://console.firebase.google.com/project/mobile-wallet-mm-snap-staging/config/env/firebase)).
You need permission to open this.

## Debugging

If you need to open the snap console, see steps [here](https://docs.metamask.io/guide/snaps-development-guide.html#debugging-your-snap)

# Custom RPC methods

-   [Methods](#methods)
    -   [tss_isPaired](#tss_ispaired)
    -   [tss_unpair](#tss_unpair)
    -   [tss_initPairing](#tss_initpairing)
    -   [tss_runPairing](#tss_runpairing)
    -   [tss_runKeygen](#tss_runkeygen)
    -   [tss_snapVersion](#tss_snapVersion)
-   [Errors](#errors)

# Keyring Methods

## Methods

### tss_isPaired

Checks if the current plugin is paired with a mobile app.

**Parameters**: None

**Returns**:

-   `isPaired`: A boolean that indicates if the plugin is paired with a mobile app.
-   `deviceName`: A string representing the name of the device paired with, or null if not paired.

### tss_unpair

Unpair the plugin from the mobile app.

**Parameters**: None

**Returns**: None

### tss_initPairing

Initiate pairing with a new mobile application.

**Parameters**: None

**Returns**:

-   `qrCode`: A string representing the QR code message needed for pairing.

### tss_runPairing

Run the pairing process.

**Parameters**: None

**Returns**:

-   `pairing_status`: A string representing the status of the pairing ('paired').
-   `device_name`: A string representing the name of the paired device.
-   `elapsed_time`: The elapsed time for the pairing process in milliseconds.
-   `used_backup_data`: A boolean indicating if backup data was used in the pairing process.

### tss_runRefresh

Refresh the pairing with the mobile application.

**Parameters**: None

**Returns**: Object with refreshed pairing data.

### tss_runDKG

Runs the Distributed Key Generation (DKG) protocol to create a new distributed key.

**Parameters**: None

**Returns**:

-   `dkgResponse`: An object containing information about the generated distributed key, including the public key and elapsed time.

### tss_runPairingAndDKG

Run the pairing process and then the DKG protocol.

**Parameters**: None

**Returns**:

-   `pairingResponse`: An object similar to the return of [tss_runPairing](#tss_runpairing).
-   `dkgResponse`: An object similar to the return of [tss_runDKG](#tss_rundkg) (optional, only if a new distributed key is generated).

### tss_sendSignRequest

Send a request to sign a message or Ethereum transaction.

**Parameters**:

-   `public_key`: The public key used for signing.
-   `hash_alg`: The hash algorithm used.
-   `message`: The message to be signed.
-   `message_hash`: The hash of the message to be signed.
-   `sign_metadata`: The type of the sign request, can be 'eth_transaction' or 'eth_sign'.

**Returns**:

-   A signed message or transaction.

## Errors

If an error occurs during any of the methods, an error object is thrown with the following properties:

-   `message`: A string describing the error.
-   `code`: A number representing the error code.

Some common error codes are:

-   `SnapErrorCode.NotPaired`: Indicates the plugin is not paired yet.
-   `SnapErrorCode.RejectedRequest`: Indicates the user rejected the request.
-   `SnapErrorCode.AlreadyPaired`: Indicates the plugin is already paired.
-   `SnapErrorCode.UnknownMethod`: Indicates an unknown method was called.
-   `SnapErrorCode.NoDistributedKeyFound`: Indicates no distributed key found for the public key provided.
-   `SnapErrorCode.InvalidMessageHashLength`: Indicates an invalid message hash length, should be 32 bytes.
