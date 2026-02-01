"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquareOff,
  AlertTriangle,
  Gauge,
  ChevronRight,
  Globe,
  Bot,
  ShieldAlert,
  CheckCircle2,
  Flame,
  HelpCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchQueries, type ApiQuery } from "@/lib/queries-api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

// --- Types (aligned with your data model) ---
type RiskTag = "normal" | "refund" | "fraud" | "safety" | "highRisk";
type FailureReason =
  | "Low intent confidence"
  | "Entity missing (station, date, battery ID)"
  | "Ambiguous query"
  | "Out-of-scope request"
  | "Policy restricted (refund, SIM change)"
  | "Incomplete information provided"
  | (string & {});

export interface QueryRecord {
  id: string;
  timestamp: Date;
  driverId: string;
  driverName: string;
  language: string;
  intentPredicted: string;
  intentConfidence: number;
  entities: Record<string, string>;
  failureReason: FailureReason;
  riskTag: RiskTag;
  riskScore?: number;
  rawText: string;
  translatedText?: string;
  voiceConfidence?: number;
  suggestedIntent?: string;
  suggestedFollowUps?: string[];
  deepLinks?: { label: string; href: string }[];
  slaBreach?: boolean;
  slaMinutesLeft?: number;
}

function mapApiQueryToRecord(api: ApiQuery): QueryRecord {
  const confidence = parseFloat(api.confidence) || 0;
  const riskTag = (api.riskTag === "highRisk" ? "highRisk" : api.riskTag) as RiskTag;
  return {
    id: String(api.id),
    timestamp: new Date(api.createdAt),
    driverId: api.driverId,
    driverName: api.driverId,
    language: api.language.charAt(0).toUpperCase() + api.language.slice(1),
    intentPredicted: api.intent.replace(/([A-Z])/g, " $1").trim() || api.intent,
    intentConfidence: confidence,
    entities: {},
    failureReason: api.failureReason as FailureReason,
    riskTag,
    rawText: api.summary,
    translatedText: undefined,
    suggestedIntent: api.action === "escalated" ? "Escalated" : undefined,
  };
}

// --- Smart view filters (labels only; filter logic uses query data) ---
const SMART_VIEWS = [
  { id: "all", label: "All", icon: MessageSquareOff },
  { id: "refund_risk", label: "Refund + High Risk", icon: Flame },
  { id: "low_conf", label: "Low confidence", icon: HelpCircle },
];

function formatTimeAgo(d: Date) {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

function getRiskBadgeVariant(tag: RiskTag): "default" | "secondary" | "destructive" | "outline" {
  if (tag === "fraud" || tag === "safety" || tag === "highRisk") return "destructive";
  if (tag === "refund") return "secondary";
  return "outline";
}

function getConfidenceColor(conf: number) {
  if (conf >= 0.7) return "text-emerald-600 dark:text-emerald-400";
  if (conf >= 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function DashboardPage() {
  const [selectedQuery, setSelectedQuery] = useState<QueryRecord | null>(null);
  const [activeView, setActiveView] = useState("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [queries, setQueries] = useState<QueryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverIdFilter, setDriverIdFilter] = useState("");

  const loadQueries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQueries(driverIdFilter.trim() || undefined);
      setQueries(data.map(mapApiQueryToRecord));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load queries";
      setError(message);
      setQueries([]);
    } finally {
      setLoading(false);
    }
  }, [driverIdFilter]);

  useEffect(() => {
    loadQueries();
  }, [loadQueries]);

  const filteredQueries = useMemo(() => {
    let list = [...queries];
    if (languageFilter !== "all")
      list = list.filter((q) => q.language.toLowerCase() === languageFilter.toLowerCase());
    if (riskFilter !== "all")
      list = list.filter((q) => q.riskTag === riskFilter);
    if (activeView === "refund_risk")
      list = list.filter((q) => q.riskTag === "refund" || q.riskTag === "fraud" || q.riskTag === "highRisk");
    if (activeView === "low_conf")
      list = list.filter((q) => q.intentConfidence < 0.5);
    return list;
  }, [queries, activeView, languageFilter, riskFilter]);

  const kpis = useMemo(() => {
    const total = queries.length;
    const highRisk = queries.filter(
      (q) => q.riskTag === "highRisk" || q.riskTag === "fraud" || q.riskTag === "refund"
    ).length;
    const avgConfidence =
      total > 0
        ? Math.round(
            (queries.reduce((s, q) => s + q.intentConfidence, 0) / total) * 100
          )
        : 0;
    return [
      {
        key: "unresolved",
        label: "Unresolved bot queries",
        value: total,
        icon: MessageSquareOff,
        colorClass: "from-violet-500/20 to-violet-600/5 border-violet-500/30 text-violet-600 dark:text-violet-400",
        delay: 0,
      },
      {
        key: "highRisk",
        label: "High-risk / Escalated",
        value: highRisk,
        icon: AlertTriangle,
        colorClass: "from-amber-500/20 to-orange-600/5 border-amber-500/30 text-amber-600 dark:text-amber-400",
        delay: 0.05,
      },
      {
        key: "confidence",
        label: "Avg bot confidence score",
        value: `${avgConfidence}%`,
        icon: Gauge,
        colorClass: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
        delay: 0.1,
      },
    ];
  }, [queries]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="mx-auto max-w-[1600px] space-y-6 p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2"
        >
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Agent Command Center
          </h1>
          <p className="text-muted-foreground">
            AI failed — but didn&apos;t leave the agent alone. Triage, act, and
            close.
          </p>
        </motion.div>

        {/* KPI Cards (derived from API data) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi) => (
            <motion.div
              key={kpi.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: kpi.delay, duration: 0.3 }}
            >
              <Card
                className={cn(
                  "overflow-hidden border bg-card/80 backdrop-blur-sm transition-shadow hover:shadow-md",
                  kpi.colorClass
                )}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.label}
                  </CardTitle>
                  <kpi.icon className="h-4 w-4 opacity-70" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="queue" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="queue">Failure Queue</TabsTrigger>
              <TabsTrigger value="metrics">Manager Metrics</TabsTrigger>
            </TabsList>

            {/* Smart views + filters (only on queue tab) */}
            <div className="flex flex-wrap items-center gap-2">
              {SMART_VIEWS.map((v) => (
                <Button
                  key={v.id}
                  variant={activeView === v.id ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveView(v.id)}
                >
                  <v.icon className="mr-1 h-3.5 w-3.5" />
                  {v.label}
                </Button>
              ))}
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger className="w-[120px]">
                  <Globe className="mr-1 h-3.5 w-3.5" />
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="hindi">Hindi</SelectItem>
                  <SelectItem value="tamil">Tamil</SelectItem>
                  <SelectItem value="mix">Mix</SelectItem>
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-[110px]">
                  <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                  <SelectValue placeholder="Risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="fraud">Fraud</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="highRisk">High Risk</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Driver ID"
                  className="w-[120px]"
                  value={driverIdFilter}
                  onChange={(e) => setDriverIdFilter(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadQueries()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadQueries}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <TabsContent value="queue" className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={loadQueries}
                >
                  Retry
                </Button>
              </Alert>
            )}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border bg-card/60 shadow-sm"
            >
              <div className="border-b px-4 py-3">
                <h2 className="font-semibold">Bot Failure Queue</h2>
                <p className="text-sm text-muted-foreground">
                  Each row is a driver query the bot couldn&apos;t resolve. Click
                  to open detail. Data from <code className="text-xs">/api/queries</code>
                  {driverIdFilter.trim() && (
                    <> · filtered by driver <strong>{driverIdFilter.trim()}</strong></>
                  )}
                </p>
              </div>
              {loading && queries.length === 0 ? (
                <div className="flex h-[420px] items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading queries…</span>
                </div>
              ) : (
              <ScrollArea className="h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Intent (bot)</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Failure Reason</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {filteredQueries.map((q, index) => (
                        <motion.tr
                          key={q.id}
                          layout
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            "border-b transition-colors cursor-pointer",
                            selectedQuery?.id === q.id && "bg-primary/5"
                          )}
                          onClick={() => setSelectedQuery(q)}
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {formatTimeAgo(q.timestamp)}
                            {q.slaBreach && (
                              <Badge variant="destructive" className="ml-1">
                                SLA
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{q.driverName}</span>
                            <span className="block text-xs text-muted-foreground">
                              {q.driverId}
                            </span>
                          </TableCell>
                          <TableCell>{q.language}</TableCell>
                          <TableCell className="max-w-[140px] truncate">
                            {q.intentPredicted}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "font-medium",
                                getConfidenceColor(q.intentConfidence)
                              )}
                            >
                              {Math.round(q.intentConfidence * 100)}%
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                            {q.failureReason}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getRiskBadgeVariant(q.riskTag)}>
                              {q.riskTag}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedQuery(q);
                              }}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </ScrollArea>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-4 md:grid-cols-2"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Top failure intents</CardTitle>
                  <CardDescription>From current query set</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(() => {
                    const byIntent = queries.reduce<Record<string, number>>((acc, q) => {
                      acc[q.intentPredicted] = (acc[q.intentPredicted] ?? 0) + 1;
                      return acc;
                    }, {});
                    const total = queries.length;
                    const entries = Object.entries(byIntent).sort((a, b) => b[1] - a[1]);
                    if (entries.length === 0) {
                      return <p className="text-sm text-muted-foreground">No data</p>;
                    }
                    return entries.map(([intent, count]) => (
                      <div key={intent} className="flex justify-between text-sm">
                        <span>{intent}</span>
                        <span className="text-muted-foreground">
                          {total ? Math.round((count / total) * 100) : 0}%
                        </span>
                      </div>
                    ));
                  })()}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Query Detail Sheet (Agent View) */}
      <Sheet open={!!selectedQuery} onOpenChange={(open) => !open && setSelectedQuery(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-xl"
          showCloseButton={true}
        >
          {selectedQuery && (
            <QueryDetailPanel
              query={selectedQuery}
              onClose={() => setSelectedQuery(null)}
              onResolve={(q) => {
                setQueries((prev) => prev.filter((x) => x.id !== q.id));
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function QueryDetailPanel({
  query,
  onClose,
  onResolve,
}: {
  query: QueryRecord;
  onClose: () => void;
  onResolve?: (query: QueryRecord) => void;
}) {
  const handleResolve = () => {
    onResolve?.(query);
    onClose();
  };

  return (
    <div className="space-y-6 pb-12">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Query detail
        </SheetTitle>
        <SheetDescription>
          Driver: {query.driverName} ({query.driverId})
        </SheetDescription>
      </SheetHeader>

      <p className="rounded-md bg-muted/50 p-4 text-sm leading-relaxed">
        {query.rawText}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleResolve}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Resolve
        </Button>
      </div>
    </div>
  );
}
