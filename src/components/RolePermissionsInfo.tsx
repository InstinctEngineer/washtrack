import { Info } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { UserRole } from "@/types/database";

interface RolePermissionsInfoProps {
  currentUserRole: UserRole | null;
}

const roleDetails: Record<UserRole, { description: string; canDo: string[] }> = {
  employee: {
    description: "Basic system access for recording washes",
    canDo: [
      "Mark washes for vehicles",
      "View own wash history",
      "Submit supply requests",
      "Create new vehicles at their location",
    ],
  },
  manager: {
    description: "Manage team operations at assigned location",
    canDo: [
      "All Employee permissions",
      "Approve supply requests for location",
      "View all users at their location",
      "View team metrics and performance",
    ],
  },
  finance: {
    description: "Financial oversight and reporting",
    canDo: [
      "All Manager permissions",
      "Generate billing exports",
      "Approve supply orders (all locations)",
      "View financial reports",
      "View all wash entries system-wide",
    ],
  },
  admin: {
    description: "Full system administration (except Super Admin accounts)",
    canDo: [
      "All Finance permissions",
      "Create/manage users (except Super Admin)",
      "Manage locations and vehicle types",
      "Configure system settings",
      "Delete/update wash entries",
    ],
  },
  super_admin: {
    description: "Complete system access and control",
    canDo: [
      "All Admin permissions",
      "Create/manage Super Admin accounts",
      "View and edit all users including Super Admins",
      "Full system override capabilities",
      "Access to all security features",
    ],
  },
};

const roleHierarchy: Record<UserRole, UserRole[]> = {
  employee: ["employee"],
  manager: ["manager", "employee"],
  finance: ["finance", "manager", "employee"],
  admin: ["admin", "finance", "manager", "employee"],
  super_admin: ["super_admin", "admin", "finance", "manager", "employee"],
};

const roleColors: Record<UserRole, string> = {
  employee: "bg-gray-500",
  manager: "bg-blue-500",
  finance: "bg-green-500",
  admin: "bg-red-500",
  super_admin: "bg-purple-500",
};

export const RolePermissionsInfo = ({ currentUserRole }: RolePermissionsInfoProps) => {
  if (!currentUserRole) return null;

  const visibleRoles = roleHierarchy[currentUserRole] || [];

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Info className="h-4 w-4" />
          Role Permissions Guide
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-96 max-h-[500px] overflow-y-auto" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">Permission Levels</h4>
            <p className="text-xs text-muted-foreground">
              Hover over each role to see detailed permissions
            </p>
          </div>

          <div className="space-y-3">
            {visibleRoles.map((role) => (
              <HoverCard key={role}>
                <HoverCardTrigger asChild>
                  <div className="flex items-start gap-2 cursor-pointer hover:bg-accent p-2 rounded-md transition-colors">
                    <Badge className={`${roleColors[role]} shrink-0`}>
                      {role.replace("_", " ")}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {roleDetails[role].description}
                      </p>
                    </div>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80" side="right">
                  <div className="space-y-3">
                    <div>
                      <Badge className={roleColors[role]}>
                        {role.replace("_", " ")}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Permissions:</p>
                      <ul className="space-y-1">
                        {roleDetails[role].canDo.map((permission, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{permission}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ))}
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              You can only see roles at or below your permission level
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
