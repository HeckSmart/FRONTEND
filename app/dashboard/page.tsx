"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquareOff,
  AlertTriangle,
  Gauge,
  Clock,
  AlertCircle,
  ChevronRight,
  Globe,
  Bot,
  ShieldAlert,
  CheckCircle2,
  Send,
  ArrowUpRight,
  Database,
  Flame,
  Timer,
  HelpCircle,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

// --- Types (aligned with your data model) ---
type RiskTag = "normal" | "refund" | "fraud" | "safety";
type FailureReason =
  | "Low intent confidence"
  | "Entity missing (station, date, battery ID)"
  | "Ambiguous query"
  | "Out-of-scope request"
  | "Policy restricted (refund, SIM change)";

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

// --- Mock data ---
const MOCK_QUERIES: QueryRecord[] = [
  {
    id: "1",
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    driverId: "DRV-2847",
    driverName: "Ramesh K.",
    language: "Hindi",
    intentPredicted: "Check Swap History",
    intentConfidence: 0.42,
    entities: { date: "kal", station: "", battery_id: "" },
    failureReason: "Entity missing (station, date, battery ID)",
    riskTag: "normal",
    rawText:
      "Bhai kal wali swap ka paisa kaat liya, par app mein kuch dikh nahi raha",
    translatedText:
      "Bro, the money for yesterday's swap was deducted but I don't see anything in the app",
    voiceConfidence: 0.88,
    suggestedIntent: "Swap history + billing issue",
    suggestedFollowUps: ["Which station?", "Exact date?"],
    deepLinks: [
      { label: "Open swap history", href: "#" },
      { label: "Open billing ledger", href: "#" },
    ],
    slaBreach: false,
    slaMinutesLeft: 22,
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    driverId: "DRV-1092",
    driverName: "Priya S.",
    language: "Tamil",
    intentPredicted: "Refund Request",
    intentConfidence: 0.31,
    entities: {},
    failureReason: "Policy restricted (refund, SIM change)",
    riskTag: "refund",
    riskScore: 72,
    rawText: "Enakku refund venum, battery damage aachu",
    translatedText: "I need a refund, the battery got damaged",
    suggestedIntent: "Refund request",
    slaBreach: true,
    slaMinutesLeft: -5,
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 3 * 60 * 1000),
    driverId: "DRV-5521",
    driverName: "Vikram M.",
    language: "Mix",
    intentPredicted: "Unknown",
    intentConfidence: 0.18,
    entities: {},
    failureReason: "Ambiguous query",
    riskTag: "normal",
    rawText: "Issue hai bhai",
    translatedText: "There's an issue bro",
    suggestedIntent: "General complaint — needs clarification",
    suggestedFollowUps: ["What type of issue?", "Station or app?"],
    slaBreach: false,
    slaMinutesLeft: 27,
  },
  {
    id: "4",
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    driverId: "DRV-8833",
    driverName: "Anita R.",
    language: "Hindi",
    intentPredicted: "SIM Change",
    intentConfidence: 0.55,
    entities: {},
    failureReason: "Policy restricted (refund, SIM change)",
    riskTag: "fraud",
    riskScore: 85,
    rawText: "Mera SIM change karna hai",
    translatedText: "I want to change my SIM",
    slaBreach: false,
    slaMinutesLeft: 0,
  },
  {
    id: "5",
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    driverId: "DRV-4401",
    driverName: "Suresh P.",
    language: "Hindi",
    intentPredicted: "Battery Booking",
    intentConfidence: 0.38,
    entities: { station: "Koramangala", date: "", battery_id: "" },
    failureReason: "Entity missing (station, date, battery ID)",
    riskTag: "normal",
    rawText: "Kal subah battery book karni hai",
    translatedText: "I need to book a battery tomorrow morning",
    suggestedFollowUps: ["Exact date?", "Which slot?"],
    slaBreach: false,
    slaMinutesLeft: 18,
  },
];

// --- KPI summary (derived) ---
const KPIS = [
  {
    key: "unresolved",
    label: "Unresolved bot queries (Today)",
    value: 24,
    trend: "+3",
    variant: "default" as const,
    icon: MessageSquareOff,
    colorClass: "from-violet-500/20 to-violet-600/5 border-violet-500/30 text-violet-600 dark:text-violet-400",
    delay: 0,
  },
  {
    key: "highRisk",
    label: "High-risk / Escalated",
    value: 5,
    trend: "2 new",
    variant: "destructive" as const,
    icon: AlertTriangle,
    colorClass: "from-amber-500/20 to-orange-600/5 border-amber-500/30 text-amber-600 dark:text-amber-400",
    delay: 0.05,
  },
  {
    key: "confidence",
    label: "Avg bot confidence score",
    value: "62%",
    trend: "↓ 4%",
    variant: "secondary" as const,
    icon: Gauge,
    colorClass: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    delay: 0.1,
  },
  {
    key: "aht",
    label: "Avg handling time (AHT)",
    value: "4m 32s",
    trend: "−12s",
    variant: "secondary" as const,
    icon: Clock,
    colorClass: "from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-600 dark:text-blue-400",
    delay: 0.15,
  },
  {
    key: "sla",
    label: "SLA breaches (live)",
    value: 2,
    trend: "Now",
    variant: "destructive" as const,
    icon: AlertCircle,
    colorClass: "from-red-500/20 to-red-600/5 border-red-500/30 text-red-600 dark:text-red-400",
    delay: 0.2,
  },
];

// --- Smart view filters ---
const SMART_VIEWS = [
  { id: "all", label: "All", icon: MessageSquareOff },
  { id: "refund_risk", label: "Refund + High Risk", icon: Flame },
  { id: "sla_breach", label: "SLA Breaching in 10 min", icon: Timer },
  { id: "low_conf", label: "Bot totally clueless", icon: HelpCircle },
];

function formatTimeAgo(d: Date) {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

function getRiskBadgeVariant(tag: RiskTag): "default" | "secondary" | "destructive" | "outline" {
  if (tag === "fraud" || tag === "safety") return "destructive";
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
  const [intentFilter, setIntentFilter] = useState<string>("all");

  const filteredQueries = useMemo(() => {
    let list = [...MOCK_QUERIES];
    if (languageFilter !== "all")
      list = list.filter((q) => q.language.toLowerCase() === languageFilter.toLowerCase());
    if (riskFilter !== "all")
      list = list.filter((q) => q.riskTag === riskFilter);
    if (intentFilter !== "all")
      list = list.filter((q) => q.intentPredicted === intentFilter);
    if (activeView === "refund_risk")
      list = list.filter((q) => (q.riskTag === "refund" || q.riskTag === "fraud") && (q.riskScore ?? 0) >= 50);
    if (activeView === "sla_breach")
      list = list.filter((q) => (q.slaMinutesLeft ?? 999) <= 10 && (q.slaMinutesLeft ?? 0) >= 0);
    if (activeView === "low_conf")
      list = list.filter((q) => q.intentConfidence < 0.5);
    return list;
  }, [activeView, languageFilter, riskFilter, intentFilter]);

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

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {KPIS.map((kpi, i) => (
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
                  <p className="text-xs text-muted-foreground">{kpi.trend}</p>
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
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="queue" className="space-y-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border bg-card/60 shadow-sm"
            >
              <div className="border-b px-4 py-3">
                <h2 className="font-semibold">Bot Failure Queue</h2>
                <p className="text-sm text-muted-foreground">
                  Each row is a driver query the bot couldn&apos;t resolve. Click
                  to open detail.
                </p>
              </div>
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
                  <CardTitle>Bot containment rate</CardTitle>
                  <CardDescription>Last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">78%</span>
                    <span className="text-muted-foreground">↑ 4%</span>
                  </div>
                  <Progress value={78} className="mt-2 h-2" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Top failure intents</CardTitle>
                  <CardDescription>Why bot failed</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {["Check Swap History", "Refund Request", "Battery Booking", "SIM Change"].map(
                    (intent, i) => (
                      <div
                        key={intent}
                        className="flex justify-between text-sm"
                      >
                        <span>{intent}</span>
                        <span className="text-muted-foreground">
                          {[42, 28, 18, 12][i]}%
                        </span>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Avg agent handling time</CardTitle>
                  <CardDescription>AHT</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">4m 32s</div>
                  <p className="text-sm text-muted-foreground">
                    Target: 5m — within SLA
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Query repeat rate</CardTitle>
                  <CardDescription>Same driver, same day</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">12%</div>
                  <p className="text-sm text-muted-foreground">
                    Agent vs bot resolution: 65% / 35%
                  </p>
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
}: {
  query: QueryRecord;
  onClose: () => void;
}) {
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

      {/* A. Driver Utterance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Driver utterance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="rounded-md bg-muted/50 p-3 font-mono text-sm">
            &ldquo;{query.rawText}&rdquo;
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{query.language}</Badge>
            {query.translatedText && (
              <span className="text-muted-foreground">
                → {query.translatedText}
              </span>
            )}
            {query.voiceConfidence != null && (
              <span>
                Voice transcript confidence:{" "}
                <span className={getConfidenceColor(query.voiceConfidence)}>
                  {Math.round(query.voiceConfidence * 100)}%
                </span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* B. Bot Analysis Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Bot analysis breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <span className="text-muted-foreground">Detected intent: </span>
            <span className="font-medium">{query.intentPredicted}</span>
            <span
              className={cn(
                "ml-2 font-medium",
                getConfidenceColor(query.intentConfidence)
              )}
            >
              {Math.round(query.intentConfidence * 100)}%{" "}
              {query.intentConfidence < 0.5 && "❌"}
            </span>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Extracted entities:</p>
            <ul className="list-inside list-disc space-y-0.5 text-sm">
              {Object.entries(query.entities).map(([k, v]) => (
                <li key={k}>
                  {k}: {v || "missing ❌"}
                </li>
              ))}
              {Object.keys(query.entities).length === 0 && (
                <li className="text-muted-foreground">None</li>
              )}
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">
            Failure reason: {query.failureReason}
          </p>
        </CardContent>
      </Card>

      {/* Risk & Fraud (if applicable) */}
      {query.riskScore != null && query.riskScore >= 50 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <ShieldAlert className="h-4 w-4" />
              Risk & fraud signals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Risk score: </span>
              <span
                className={cn(
                  query.riskScore >= 70
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400"
                )}
              >
                {query.riskScore} / 100 🔴
              </span>
            </div>
            <ul className="text-sm text-muted-foreground">
              <li>Synthetic voice probability: High</li>
              <li>Device mismatch</li>
              <li>Unusual refund frequency</li>
            </ul>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Step-up verification. Do NOT issue refund directly.
            </p>
          </CardContent>
        </Card>
      )}

      {/* C. Suggested Agent Actions (Agent Assist) */}
      {(query.suggestedIntent ||
        query.suggestedFollowUps?.length ||
        query.deepLinks?.length) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Suggested agent actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {query.suggestedIntent && (
              <p>
                <span className="text-muted-foreground">Likely intent: </span>
                {query.suggestedIntent}
              </p>
            )}
            {query.suggestedFollowUps && query.suggestedFollowUps.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1">Suggested follow-up:</p>
                <ul className="list-inside list-disc text-sm">
                  {query.suggestedFollowUps.map((s) => (
                    <li key={s}>&ldquo;{s}&rdquo;</li>
                  ))}
                </ul>
              </div>
            )}
            {query.deepLinks && query.deepLinks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {query.deepLinks.map((link) => (
                  <Button key={link.label} variant="outline" size="sm" asChild>
                    <a href={link.href}>
                      <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
                      {link.label}
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Agent Actions */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Agent actions
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Resolve & Close
          </Button>
          <Button variant="secondary" size="sm">
            <Send className="mr-1 h-4 w-4" />
            Request Info (SMS / App)
          </Button>
          <Button variant="destructive" size="sm">
            <ArrowUpRight className="mr-1 h-4 w-4" />
            Escalate to Tier-2
          </Button>
          <Button variant="outline" size="sm">
            <Database className="mr-1 h-4 w-4" />
            Mark as Bot Training Data
          </Button>
        </div>
      </div>

      {/* Bot Learning feedback (short) */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Bot learning — feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Correct intent? Missing entity? New intent? Query quality rating.</p>
          <Button variant="outline" size="sm">
            Submit feedback
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
