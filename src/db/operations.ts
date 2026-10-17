/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from './index.ts';
import { users, transactions, clvSnapshots } from './schema.ts';
import { eq, desc } from 'drizzle-orm';

export const CREATOR_EMAIL = 'muikimlim.insead@gmail.com';

// Synchronize user profile on sign-in with access approval checks
export async function getOrCreateUser(uid: string, email: string) {
  try {
    const isCreator = email.trim().toLowerCase() === CREATOR_EMAIL.toLowerCase();
    
    // Check if user already exists
    const existing = await db.select().from(users).where(eq(users.uid, uid));
    if (existing.length > 0) {
      const u = existing[0];
      // If creator, ensure they are always admin and approved
      if (isCreator && (u.role !== 'admin' || u.status !== 'approved')) {
        const updated = await db.update(users)
          .set({ role: 'admin', status: 'approved', email })
          .where(eq(users.uid, uid))
          .returning();
        return updated[0];
      }
      return u;
    }

    // New user
    const result = await db.insert(users)
      .values({
        uid,
        email,
        role: isCreator ? 'admin' : 'user',
        status: isCreator ? 'approved' : 'pending',
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Database user upsert failed:", error);
    throw new Error("Failed to synchronize user account.", { cause: error });
  }
}

// Get user profile by UID
export async function getUserByUid(uid: string) {
  try {
    const records = await db.select().from(users).where(eq(users.uid, uid));
    return records[0] || null;
  } catch (error) {
    console.error("Failed to fetch user by uid:", error);
    throw new Error("Failed to query user profile.", { cause: error });
  }
}

// Get all users (Admin creator only)
export async function getAllUsers() {
  try {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  } catch (error) {
    console.error("Failed to query all users:", error);
    throw new Error("Failed to query users list.", { cause: error });
  }
}

// Update user access status (approved | pending | rejected)
export async function updateUserStatus(targetUid: string, status: 'approved' | 'pending' | 'rejected') {
  try {
    const updated = await db.update(users)
      .set({ status })
      .where(eq(users.uid, targetUid))
      .returning();
    return updated[0];
  } catch (error) {
    console.error("Failed to update user status:", error);
    throw new Error("Failed to update access status.", { cause: error });
  }
}

// Fetch all transactions for a user
export async function getUserTransactions(userId: string) {
  try {
    return await db.select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    throw new Error("Failed to fetch transactions.", { cause: error });
  }
}

// Insert multiple transactions (batch)
export async function insertTransactions(
  userId: string,
  txs: Array<{
    transactionId: string;
    customerId: string;
    date: string;
    amount: number;
    source?: string;
  }>
) {
  try {
    if (txs.length === 0) return [];
    
    // Process in chunks of 500 to stay well under query parameter boundaries
    const chunkSize = 500;
    const insertedRows = [];
    
    for (let i = 0; i < txs.length; i += chunkSize) {
      const chunk = txs.slice(i, i + chunkSize).map(t => ({
        userId,
        transactionId: t.transactionId,
        customerId: t.customerId,
        date: t.date,
        amount: t.amount,
        source: t.source || 'manual'
      }));
      
      const res = await db.insert(transactions).values(chunk).returning();
      insertedRows.push(...res);
    }
    
    return insertedRows;
  } catch (error) {
    console.error("Failed to insert transactions:", error);
    throw new Error("Failed to store transactions in database.", { cause: error });
  }
}

// Clear transactions for a user (e.g. to re-import fresh dataset)
export async function deleteUserTransactions(userId: string) {
  try {
    return await db.delete(transactions).where(eq(transactions.userId, userId)).returning();
  } catch (error) {
    console.error("Failed to delete transactions:", error);
    throw new Error("Failed to clear transactions.", { cause: error });
  }
}

// Delete a single transaction by ID for a user
export async function deleteTransactionById(userId: string, id: number) {
  try {
    return await db.delete(transactions)
      .where(eq(transactions.id, id))
      .returning();
  } catch (error) {
    console.error("Failed to delete transaction by ID:", error);
    throw new Error("Failed to delete transaction.", { cause: error });
  }
}

// Save CLV and churn snapshots
export async function saveSnapshots(
  userId: string,
  snapshots: Array<{
    customerId: string;
    frequency: number;
    recency: number;
    tenure: number;
    monetaryValue: number;
    totalSpend: number;
    pAlive: number;
    expectedTransactions: number;
    expectedMonetaryValue: number;
    predictedCLV: number;
    churnRisk: number;
    segment: string;
  }>
) {
  try {
    if (snapshots.length === 0) return [];
    
    // Clear previous snapshots for fresh analysis
    await db.delete(clvSnapshots).where(eq(clvSnapshots.userId, userId));
    
    const chunkSize = 500;
    const inserted = [];
    for (let i = 0; i < snapshots.length; i += chunkSize) {
      const chunk = snapshots.slice(i, i + chunkSize).map(s => ({
        userId,
        customerId: s.customerId,
        frequency: s.frequency,
        recency: s.recency,
        tenure: s.tenure,
        monetaryValue: s.monetaryValue,
        totalSpend: s.totalSpend,
        pAlive: s.pAlive,
        expectedTransactions: s.expectedTransactions,
        expectedMonetaryValue: s.expectedMonetaryValue,
        predictedCLV: s.predictedCLV,
        churnRisk: s.churnRisk,
        segment: s.segment
      }));
      const res = await db.insert(clvSnapshots).values(chunk).returning();
      inserted.push(...res);
    }
    return inserted;
  } catch (error) {
    console.error("Failed to save snapshots:", error);
    throw new Error("Failed to save customer model snapshots.", { cause: error });
  }
}

// Get latest snapshots
export async function getLatestSnapshots(userId: string) {
  try {
    return await db.select()
      .from(clvSnapshots)
      .where(eq(clvSnapshots.userId, userId));
  } catch (error) {
    console.error("Failed to fetch snapshots:", error);
    throw new Error("Failed to fetch customer snapshots.", { cause: error });
  }
}
