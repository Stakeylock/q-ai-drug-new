"use client";

import React, { useState, useEffect, useRef } from "react";
import { showToast } from "@/utils/toast";
import { DropdownEntrance } from "./SafeMotion";

interface Notification {
  id: string;
  title: string;
  description: string;
  type: "success" | "warning" | "error" | "info";
  timestamp: string;
  read: boolean;
  actionLabel?: string;
  actionType?: "toast" | "link";
  toastMessage?: string;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: "n-1",
    title: "GNINA rescoring completed",
    description: "EGFR molecular binding affinity scores updated for 420 active ligands.",
    type: "success",
    timestamp: "5m ago",
    read: false,
    actionLabel: "View Experiment",
    actionType: "toast",
    toastMessage: "Redirecting to GNINA docking results...",
  },
  {
    id: "n-2",
    title: "Quantum reranking queued",
    description: "Hybrid classical-quantum prioritization batch J-8825 submitted to Rigetti Aspen-M-3.",
    type: "info",
    timestamp: "15m ago",
    read: false,
    actionLabel: "Monitor Queue",
    actionType: "toast",
    toastMessage: "Viewing active GPU/QPU cluster queues...",
  },
  {
    id: "n-3",
    title: "ADMET warning detected",
    description: "High cardiotoxicity risk flag (hERG block affinity > 6.2) on candidate compound QDF-481.",
    type: "warning",
    timestamp: "1h ago",
    read: false,
    actionLabel: "Run ADMET Assay",
    actionType: "toast",
    toastMessage: "Opening cardiotoxicity toxicological profile...",
  },
  {
    id: "n-4",
    title: "Candidate dossier generated",
    description: "Comprehensive validation evidence dossier successfully compiled for EGFR target group.",
    type: "success",
    timestamp: "3h ago",
    read: true,
    actionLabel: "Download PDF",
    actionType: "toast",
    toastMessage: "Downloading Candidate_Dossier_Final.pdf...",
  },
  {
    id: "n-5",
    title: "Integration sync failed",
    description: "AWS S3 oncology-vault-us-east-1 synchronization timed out after three connection attempts.",
    type: "error",
    timestamp: "1d ago",
    read: true,
    actionLabel: "Retry Sync",
    actionType: "toast",
    toastMessage: "Re-initializing S3 bucket sync...",
  },
  {
    id: "n-6",
    title: "Compute credits below threshold",
    description: "Compute allocation has dropped below 15,000 CR. Auto-top-up configured to trigger soon.",
    type: "warning",
    timestamp: "2d ago",
    read: true,
    actionLabel: "Add Credits",
    actionType: "toast",
    toastMessage: "Navigating to Credit Procurement desk...",
  },
  {
    id: "n-7",
    title: "API key rotated",
    description: "Scientific data ingestion endpoint token updated successfully by administrative request.",
    type: "info",
    timestamp: "3d ago",
    read: true,
  },
  {
    id: "n-8",
    title: "Workspace invite accepted",
    description: "Dr. Sarah Chen accepted organizational invitation to join Oncology Division.",
    type: "success",
    timestamp: "4d ago",
    read: true,
  },
];

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "critical">("all");
  
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on click outside or ESC key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast({
      title: "NOTIFICATIONS",
      message: "All scientific alerts marked as read.",
      type: "success",
    });
  };

  const toggleReadState = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const handleActionClick = (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Automatically mark as read on action
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );

    if (notification.actionType === "toast" && notification.toastMessage) {
      showToast({
        title: notification.title.toUpperCase(),
        message: notification.toastMessage,
        type: notification.type,
      });
    }
    setIsOpen(false);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "critical") return n.type === "error" || n.type === "warning";
    return true;
  });

  return (
    <div className="relative" ref={containerRef}>
      {/* Notification Bell Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border transition-all hover:bg-[color:var(--muted-bg)] focus-visible:ring-2 focus-visible:ring-accent outline-none"
        style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-black text-bg ring-2 ring-card animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Menu */}
      {isOpen && (
        <DropdownEntrance className="absolute right-0 mt-2 w-80 sm:w-96 z-50">
          <div
            role="dialog"
            aria-label="Notifications panel"
            className="w-full rounded-xl border shadow-2xl p-4 flex flex-col gap-3 backdrop-blur-xl"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border/20">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-text">
                Scientific Workflows
              </h3>
              {unreadCount > 0 && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                  {unreadCount} NEW
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[9px] font-black uppercase tracking-widest text-accent hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-1.5">
            {(["all", "unread", "critical"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider border transition-all ${
                  filter === type
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "border-border/40 text-muted-text hover:text-text hover:border-border"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border/20 pr-1">
            {filteredNotifications.length === 0 ? (
              <div className="py-8 text-center text-xs font-bold text-muted-text/50">
                No active notifications found.
              </div>
            ) : (
              filteredNotifications.map((n) => {
                let statusColor = "bg-accent";
                let typeIcon = "ℹ️";

                if (n.type === "success") {
                  statusColor = "bg-emerald-500";
                  typeIcon = "✓";
                } else if (n.type === "warning") {
                  statusColor = "bg-amber-500";
                  typeIcon = "⚠";
                } else if (n.type === "error") {
                  statusColor = "bg-rose-500";
                  typeIcon = "✕";
                }

                return (
                  <div
                    key={n.id}
                    className={`py-3 flex gap-3 group transition-colors relative rounded-lg px-2 -mx-2 hover:bg-muted-bg/30 ${
                      !n.read ? "bg-accent/[0.01]" : ""
                    }`}
                  >
                    {/* Unread status dot */}
                    {!n.read && (
                      <span className="absolute left-1.5 top-4.5 h-1.5 w-1.5 rounded-full bg-accent" />
                    )}

                    {/* Severity Indicator Icon */}
                    <div
                      className={`h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black border text-text ${
                        n.type === "success"
                          ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/[0.02]"
                          : n.type === "warning"
                          ? "border-amber-500/20 text-amber-400 bg-amber-500/[0.02]"
                          : n.type === "error"
                          ? "border-rose-500/20 text-rose-400 bg-rose-500/[0.02]"
                          : "border-border/40 text-accent bg-accent/[0.02]"
                      }`}
                    >
                      {typeIcon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h4
                          className={`text-xs font-bold truncate leading-none ${
                            !n.read ? "text-text" : "text-text/75"
                          }`}
                        >
                          {n.title}
                        </h4>
                        <span className="text-[9px] font-bold text-muted-text/40 shrink-0 uppercase">
                          {n.timestamp}
                        </span>
                      </div>
                      <p className="text-[10px] font-medium text-muted-text/80 leading-normal">
                        {n.description}
                      </p>

                      {/* Interactive Actions */}
                      <div className="flex items-center justify-between pt-1.5">
                        {n.actionLabel ? (
                          <button
                            onClick={(e) => handleActionClick(n, e)}
                            className="text-[9px] font-black uppercase tracking-widest text-accent hover:underline"
                          >
                            {n.actionLabel}
                          </button>
                        ) : (
                          <span />
                        )}

                        <button
                          onClick={(e) => toggleReadState(n.id, e)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[9px] font-bold text-muted-text/60 hover:text-text transition-all"
                          aria-label={n.read ? "Mark as unread" : "Mark as read"}
                        >
                          {n.read ? "Mark unread" : "Mark read"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-border/20 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-text/40">
            <span>QuDrugForge™ Relays</span>
            <button
              onClick={() => {
                setIsOpen(false);
                showToast({
                  title: "NOTIFICATION SYSTEM",
                  message: "Historical Relays log audit downloaded.",
                  type: "info",
                });
              }}
              className="text-accent hover:underline text-[9px]"
            >
              Audits log
            </button>
          </div>
        </div>
      </DropdownEntrance>
    )}
  </div>
  );
}
