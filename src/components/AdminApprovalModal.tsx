/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ShieldCheck, UserCheck, UserX, Clock, X, RefreshCw, Mail, AlertCircle, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AdminApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminApprovalModal({ isOpen, onClose }: AdminApprovalModalProps) {
  const { token, creatorEmail } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error("Failed to fetch user directory");
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const handleUpdateStatus = async (targetUid: string, newStatus: 'approved' | 'pending' | 'rejected') => {
    if (!token) return;
    setUpdatingUid(targetUid);
    try {
      const res = await fetch(`/api/admin/users/${targetUid}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        throw new Error("Failed to update status");
      }
      const data = await res.json();
      // Update local state
      setUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, status: newStatus } : u));
    } catch (err: any) {
      console.error(err);
      alert("Failed to update user status: " + err.message);
    } finally {
      setUpdatingUid(null);
    }
  };

  if (!isOpen) return null;

  const pendingCount = users.filter(u => u.status === 'pending' && u.email !== creatorEmail).length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-display font-bold text-slate-800 text-base">Creator Access Control Portal</h3>
                {pendingCount > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                    {pendingCount} Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage user authorizations. Only accounts marked <span className="text-emerald-600 font-semibold">Approved</span> can modify or upload customer databases.
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <button 
              onClick={fetchUsers} 
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              title="Refresh users"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {users.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              {loading ? "Loading users..." : "No users registered in the database yet."}
            </div>
          ) : (
            users.map(u => {
              const isOwner = u.email?.toLowerCase() === creatorEmail.toLowerCase();
              return (
                <div 
                  key={u.uid} 
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-800 font-mono">{u.email}</span>
                      {isOwner ? (
                        <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Creator / Owner
                        </span>
                      ) : (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          u.status === 'approved' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : u.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {u.status}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      UID: {u.uid.substring(0, 16)}... &bull; Joined: {new Date(u.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Actions for owner */}
                  {!isOwner && (
                    <div className="flex items-center space-x-2 shrink-0">
                      {u.status !== 'approved' && (
                        <button
                          onClick={() => handleUpdateStatus(u.uid, 'approved')}
                          disabled={updatingUid === u.uid}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] flex items-center space-x-1 shadow-xs transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Approve Access</span>
                        </button>
                      )}

                      {u.status !== 'rejected' && (
                        <button
                          onClick={() => handleUpdateStatus(u.uid, 'rejected')}
                          disabled={updatingUid === u.uid}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-medium text-[11px] flex items-center space-x-1 transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Revoke Access</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs text-slate-400">
          <span>Signed in as administrator: <strong className="text-slate-600">{creatorEmail}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-xs"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
