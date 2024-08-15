# Silent Shard Snap

The Silent Shard Snap aims to remove single points of failure pertaining to handling of private keys and seed phrases i.e., in current designs of wallets the private keys are stored at a single location- the local storage of the browsers.

Users have been losing access to wallets’ accounts and associated services due to phishing scams and private key theft through associated attack vector for years. This has resulted in loss of approximately USD $14 billion in 2021 alone, a blot in the face of self-sovereign non-custodial wallets which is one of the core tenets of crypto. The Silent Snap Shard aims to remove this entirely with our MPC SDK for {2,2} TSS.

Using Snap, allows us to prove how Multi-Party Computation-based signature schemes can be built at the core of wallets like MetaMask. Users will be able to get access to any WebApps using MetaMask as one shard node wherein Snap provides a way to extend MetaMask’s functionality- provide DAapps with JSON-RPC API methods for MPC supported signatures. Essentially, the snap comprises of the core threshold signature functions and WebApps would be provided with functionality to make necessary calls and handling UI elements.

## How to run

-   Use node version 18 or greater.
-   Use yarn version 3.2.1
-   Now run, `yarn install`, to install the libraries
-   Run, `yarn start` to run snap on local environment. This also have fast refresh so no need to build snap again after changes.

## How to build

- Run `yarn build` or `yarn build:prod` for build production Snap
- Run `yarn build:stg` for build staging Snap

## How to publish

### Pre-publish
-   Update the version of snap in `package.json`.
-   Run `yarn prepublish:stg` or `yarn prepublish:prod` to update correct metadata for `package.json` and bundle the Snap with right `snap.config` file.
-   Update the version in firebase function in `snapVersion.ts` file and deploy.

### Publish
-   To publish the snap run `npm publish`. You will need to login with valid npm account before deploying new version. If you encounter any issue, delete the .npmrc and try again.

## How to test

- Use [Snap Jest preset](https://github.com/MetaMask/snaps/tree/main/packages/snaps-jest) for e2e tests.
- Run `yarn test` or `yarn test --coverage` to see test result and coverage.
- While you see this warning `@firebase/firestore: Firestore (9.23.0): GrpcConnection RPC 'Listen' stream 0x1ce2204b error. Code: 1 Message: 1 CANCELLED: Disconnecting idle stream. Timed out waiting for new targets.` after running the test, its due to: https://github.com/jestjs/jest/issues/11464 

## How to give force update for snap (Experimental)
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
    -   [tss_runRePairing](#tss_runRePairing)
    -   [tss_snapVersion](#tss_snapVersion)
    -   [tss_setSnapVersion](#tss_setSnapVersion)

# Keyring Methods

-   Supported keyring methods
    -   listAccounts
    -   createAccount
    -   updateAccount
    -   deleteAccount
    -   submitRequest

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

-   `address`: A string representing the address of the account if present, otherwise return null.
-   `device_name`: A string representing the name of the paired device.

### tss_runRePairing

Repair with the moible application. This method can be used only when snap is already paired.

**Parameters**: None

**Returns**: 
-   `currentAccountAddress`: A string representing the address of current account.
-   `newAccountAddress`: A string representing the address of current account if repaired with the same account otherwise the new address will be returned corresponding the new account used for pairing.
-   `device_name`: A string representing the name of the new paired device.

### tss_runKeygen

Runs the Distributed Key Generation (DKG) protocol to create a new distributed key.

**Parameters**: None

**Returns**:

-   `address`: A string representing the address of the account if present, otherwise return null.

### tss_runSign

(This method is not available outside snap)
Send a request to sign a message or Ethereum transaction.

# Errors

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

More details of error can be found [here](https://github.com/silence-laboratories/silent-shard-snap/blob/main/src/error.ts)
