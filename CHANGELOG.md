# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.9]
- New runBackup rpc method to send backup, add address and walletId to backup [`35`](https://github.com/silence-laboratories/silent-shard-snap/pull/35) [`36`](https://github.com/silence-laboratories/silent-shard-snap/pull/36)
- Remove load balancer [`37`]
(https://github.com/silence-laboratories/silent-shard-snap/pull/37)

## [1.2.8]
- Set snap version using update snap RPC method [`#31`](https://github.com/silence-laboratories/silent-shard-snap/pull/31)
- E2e test [`#28`](https://github.com/silence-laboratories/silent-shard-snap/pull/28)
- Mm 405 use load balancer endpoints of firebase function for snap [`#29`](https://github.com/silence-laboratories/silent-shard-snap/pull/29)

## [1.2.7] - 2024-03-15

### Added

- Add pairingRemark to handle failure cases [`#26`](https://github.com/silence-laboratories/silent-shard-snap/pull/26)
- Complete set up script to build staging and production environment se… [`#24`](https://github.com/silence-laboratories/silent-shard-snap/pull/24)
- Add copyright header to source files [`#20`](https://github.com/silence-laboratories/silent-shard-snap/pull/20)
- Add license [`#19`](https://github.com/silence-laboratories/silent-shard-snap/pull/19)
- Repairing flow added [`10c8c56`](https://github.com/silence-laboratories/silent-shard-snap/commit/10c8c56e012d6422ca4dcd3efee60076207b7410)

## [1.2.6] - 2024-01-20

### Fixed

- Update the random for pairing id and added description [`#17`](https://github.com/silence-laboratories/silent-shard-snap/pull/17)
- Update source of randomness for pairing id [`#18`](https://github.com/silence-laboratories/silent-shard-snap/pull/18)

### Changed

- Sync package files and bump Snap version to 1.2.3 [`#14`](https://github.com/silence-laboratories/silent-shard-snap/pull/14)
- Update dependencies and remove github actions [`#12`](https://github.com/silence-laboratories/silent-shard-snap/pull/12)

### Added

- Add keyring permission, update logging [`#16`](https://github.com/silence-laboratories/silent-shard-snap/pull/16)


## [1.1.19] - 2023-10-30
### Changed
- Updates for the latest Keyring API
- Support of the Duo SDK as the client

## [1.1.1] - 2023-04-02
### Changed
Following changes have been made to snap based on breaking changes in [Flask 10.23](https://github.com/MetaMask/snaps-monorepo/discussions/1101)  and [Flask 10.25](https://github.com/MetaMask/snaps-monorepo/discussions/1198)
- `wallet_requestSnaps` used
- endowment rpc permission in manifest
- `wallet_invokeSnap`, `snap_manageState` syntax update
- webpack config updated to add Buffer polyfill
- `wallet` removed from namespace, using `snap` instead
- `sqs credentials` updated

## [1.1.0] - 2022-12-07
### Added
- ECDSA TSS(2,2) JS library
### Changed
- Separated Pairing and Keygen flows
- Removed message hash calculation from sdk for Sign
