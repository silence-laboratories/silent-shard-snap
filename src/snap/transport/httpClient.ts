// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import { SnapError, SnapErrorCode } from '../error';

interface Response {
  response: any;
  error: string;
}

export default class HttpClient {
  #baseUrl: string;

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl;
  }

  /**
   * Modified fetch is build on fetch to read the response in expected way and handle errors
   * 
   * @param input 
   * @param init 
   * @returns Response
   */
  #modifiedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    return await fetch(input, init)
      .then(async (data) => {
        const temp: Response = await data.json();
        if (temp.error) {
          throw new SnapError(temp.error, SnapErrorCode.FirebaseError);
        } else return temp.response;
      })
      .catch((error) => {
        if (error instanceof SnapError) {
          throw error;
        }
        if (error instanceof Error) {
          throw new SnapError(error.message, SnapErrorCode.FirebaseError);
        } else
          throw new SnapError(
            `unkown-error`,
            SnapErrorCode.FirebaseError,
          );
      });
  };


  /**
   * get JWT token for accessing other endpoints.
   * 
   * @param pairingId 
   * @param signature 
   */
  getTokenEndpoint = async (
    pairingId: string,
    signature: string,
  ) => {
    const url = this.#baseUrl + `/getToken`;
    const data: {
      token: string;
      appPublicKey: string;
      deviceName: string;
      tokenExpiration: number;
      backupData?: string;
    } = await this.#modifiedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pairingId, signature }),
    });
    return data;
  };

  /**
   * Refresh JWT token
   * 
   * @param token 
   * @param signedToken 
   */
  refreshTokenEndpoint = async (
    token: string,
    signedToken: string,
  ) => {
    const url = this.#baseUrl + `/refreshToken`;
    const data: {
      token: string;
      tokenExpiration: number;
    } = await this.#modifiedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        signedToken,
      }),
    });
    return data;
  };

  /**
   * Send Message to the mobile
   * using expectResponse, we can wait for the response.
   * 
   * @param token 
   * @param type 
   * @param conversation 
   * @param expectResponse 
   * @param docId 
   */
  sendMessage = async <T>(
    token: string,
    type: 'keygen' | 'sign' | 'pairing' | 'backup' | 'users',
    conversation: T | null,
    expectResponse: boolean,
    docId?: string,
  ) => {
    const url = this.#baseUrl + `/sendMessage`;
    const data: T | null = await this.#modifiedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        collection: type,
        data: conversation,
        expectResponse,
        docId,
      }),
    });
    return data;
  };

  /**
   * Get snap version from server.
   */
  snapVersion = async () => {
    const url = this.#baseUrl + `/snapVersion`;
    const data = await fetch(url);
    return await data.text();
  };
}