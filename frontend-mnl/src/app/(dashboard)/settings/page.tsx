"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared";
import ComputeDashboard from "@/components/compute/ComputeDashboard";
import StorageDashboard from "@/components/storage/StorageDashboard";
import ApiDashboard from "@/components/api/ApiDashboard";
import IntegrationsDashboard from "@/components/integrations/IntegrationsDashboard";
import TeamDashboard from "@/components/team/TeamDashboard";
import BillingDashboard from "@/components/billing/BillingDashboard";
import AuditDashboard from "@/components/audit/AuditDashboard";
import GeneralSettings from "@/components/settings/GeneralSettings";

function SettingsContent() {
  const searchParams = useSearchParams();
  const section = searchParams.get("section");

  if (section === "compute") {
    return <ComputeDashboard />;
  }

  if (section === "storage") {
    return <StorageDashboard />;
  }

  if (section === "api") {
    return <ApiDashboard />;
  }

  if (section === "integrations") {
    return <IntegrationsDashboard />;
  }

  if (section === "team") {
    return <TeamDashboard />;
  }

  if (section === "billing") {
    return <BillingDashboard />;
  }

  if (section === "audit") {
    return <AuditDashboard />;
  }

  return <GeneralSettings />;
}


export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="page-shell">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}


