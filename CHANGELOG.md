# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
