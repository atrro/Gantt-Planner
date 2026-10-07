import { Activity } from "@/pages/Schedule";
import { Button } from "@/components/ui/button";
import { Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActivityListProps {
  activities: Activity[];
  onRemove: (id: string) => void;
}

export const ActivityList = ({ activities, onRemove }: ActivityListProps) => {
  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-1 rounded">
                  Seq {activity.activityDescription}
                </span>
                <span className="text-sm font-medium">
                  {activity.functionalDescription}
                </span>
                <span className="text-sm text-muted-foreground">
                  Serial: {activity.serialNumber}
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {format(activity.startDate, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                    {format(activity.endDate, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <span className="bg-accent/10 text-accent px-2 py-1 rounded">
                  {activity.duration} dias
                </span>
                {activity.predecessor && (
                  <span className="text-xs">
                    Predecessor: {activity.predecessor}
                  </span>
                )}
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(activity.id)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
