import { AuditLog } from "@/components/compliance/AuditLog";

export const metadata = {
  title: "Audit Log — PayMaster",
  description: "Compliance audit trail — every decision explained.",
};

export default function ComplianceAuditPage() {
  return (
    <div className="space-y-5 pb-16">
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">Compliance Audit Log</h1>
        <p className="text-gray-500 text-[13px] mt-1">
          Every transfer decision is recorded — screening, monitoring, risk, policy, Travel Rule and execution — so
          &quot;why was this transfer approved or blocked?&quot; is always answerable.
        </p>
      </div>
      <AuditLog />
    </div>
  );
}
