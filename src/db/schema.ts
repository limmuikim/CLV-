/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { relations } from 'drizzle-orm';
import { pgTable, serial, text, timestamp, doublePrecision, integer } from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Transactions table for continuously updated customer orders
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid)
    .notNull(),
  transactionId: text('transaction_id').notNull(),
  customerId: text('customer_id').notNull(),
  date: text('date').notNull(), // Expected format: YYYY-MM-DD
  amount: doublePrecision('amount').notNull(),
  source: text('source').default('manual'), // 'manual', 'csv_import', 'webhook', 'seed'
  createdAt: timestamp('created_at').defaultNow(),
});

// Continuous snapshot records of CLV predictions and churn risks
export const clvSnapshots = pgTable('clv_snapshots', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid)
    .notNull(),
  customerId: text('customer_id').notNull(),
  frequency: integer('frequency').notNull(),
  recency: integer('recency').notNull(),
  tenure: integer('tenure').notNull(),
  monetaryValue: doublePrecision('monetary_value').notNull(),
  totalSpend: doublePrecision('total_spend').notNull(),
  pAlive: doublePrecision('p_alive').notNull(),
  expectedTransactions: doublePrecision('expected_transactions').notNull(),
  expectedMonetaryValue: doublePrecision('expected_monetary_value').notNull(),
  predictedCLV: doublePrecision('predicted_clv').notNull(),
  churnRisk: doublePrecision('churn_risk').notNull(),
  segment: text('segment').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  clvSnapshots: many(clvSnapshots),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.uid],
  }),
}));

export const clvSnapshotsRelations = relations(clvSnapshots, ({ one }) => ({
  user: one(users, {
    fields: [clvSnapshots.userId],
    references: [users.uid],
  }),
}));
