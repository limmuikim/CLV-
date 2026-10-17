/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getUserByUid, getOrCreateUser, CREATOR_EMAIL } from '../db/operations.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: {
    id: number;
    uid: string;
    email: string;
    role: string;
    status: string;
  };
}

// 1. Verify that user has a valid Firebase session token
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required to access this resource.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }
};

// 2. Strict Access Control Gate: Verify that user is either the creator (muikimlim.insead@gmail.com) OR an approved user
export const requireApprovedAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const uid = req.user?.uid;
  const email = req.user?.email || '';

  if (!uid) {
    return res.status(401).json({ error: 'Unauthorized: Missing user identity.' });
  }

  try {
    // Creator always has unconditional approved access
    if (email.trim().toLowerCase() === CREATOR_EMAIL.toLowerCase()) {
      return next();
    }

    // Query user profile in Cloud SQL
    let userRecord = await getUserByUid(uid);
    if (!userRecord) {
      userRecord = await getOrCreateUser(uid, email);
    }

    if (userRecord.status !== 'approved') {
      return res.status(403).json({
        error: 'Access Restricted: Your account is pending creator authorization. Please contact muikimlim.insead@gmail.com to request access.',
        status: userRecord.status,
        creatorEmail: CREATOR_EMAIL
      });
    }

    req.dbUser = userRecord;
    next();
  } catch (error) {
    console.error('Access check error:', error);
    return res.status(500).json({ error: 'Failed to verify account permissions.' });
  }
};

// 3. Admin Creator Only Gate (for managing user access and approving requests)
export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const email = req.user?.email || '';
  if (email.trim().toLowerCase() !== CREATOR_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }
  next();
};
