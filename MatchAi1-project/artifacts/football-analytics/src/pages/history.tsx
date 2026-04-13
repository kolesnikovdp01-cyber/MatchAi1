import { useState } from "react";
import { useListHistory, ListHistoryStatus, ListHistoryType } from "@workspace/api-client-react";
import { PredictionCard } from "@/components/prediction-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { History as HistoryIcon } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export default function History() {
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<ListHistoryStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ListHistoryType | "all">("all");

  const params: any = {};
  if (statusFilter !== "all") params.status = statusFilter;
  if (typeFilter !== "all") params.type = typeFilter;

  const { data: history, isLoading } = useListHistory(params);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <HistoryIcon className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold font-mono text-primary tracking-tight uppercase">{t("history.title")}</h1>
          </div>
          <p className="text-muted-foreground">{t("history.subtitle")}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
            <SelectTrigger className="font-mono bg-card w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("history.typeAll")}</SelectItem>
              <SelectItem value="ai">{t("history.typeAi")}</SelectItem>
              <SelectItem value="author">{t("history.typeAuthor")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
            <SelectTrigger className="font-mono bg-card w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("history.statusAll")}</SelectItem>
              <SelectItem value="pending">{t("history.statusPending")}</SelectItem>
              <SelectItem value="win">{t("history.statusWin")}</SelectItem>
              <SelectItem value="lose">{t("history.statusLose")}</SelectItem>
              <SelectItem value="refund">{t("history.statusRefund")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading || !history ? (
        <div className="space-y-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-md" />)}</div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-card/30 rounded-lg border border-dashed border-border/50">
          <HistoryIcon className="h-12 w-12 mb-4 opacity-20" />
          <p className="font-mono">{t("history.noRecords")}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {history.map((entry: any) => <PredictionCard key={entry.id} prediction={entry} type="history" />)}
        </div>
      )}
    </div>
  );
}
