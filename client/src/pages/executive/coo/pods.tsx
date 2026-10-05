import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { FolderKanban, Plus, Users, ChevronRight } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Pod, User } from "@shared/schema";

const MAX_SPECIALISTS_PER_POD = 12;

function formatPodType(value?: string | null) {
  return String(value || "").toLowerCase() === "paid" ? "Paid" : "Training";
}

function formatStudentCapacity(value?: string | null) {
  if (value === "6_seater") return "6 students per Specialist";
  if (value === "5_seater") return "5 students per Specialist";
  return "4 students per Specialist";
}

export default function COOPods() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const cooPodsBasePath = location.pathname.startsWith("/executive/coo/")
    ? "/executive/coo/pods"
    : "/coo/pods";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    podName: "",
    podType: "training",
    vehicle: "4_seater",
    tdId: "",
    tutorIds: [] as string[],
  });

  const {
    data: pods,
    isLoading: podsLoading,
    error: podsError,
  } = useQuery<Pod[]>({
    queryKey: ["/api/coo/pods"],
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const { data: tds, isLoading: tdsLoading } = useQuery<User[]>({
    queryKey: ["/api/coo/tds"],
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const {
    data: approvedTutors,
    isLoading: specialistsLoading,
  } = useQuery<User[]>({
    queryKey: ["/api/coo/approved-tutors"],
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const { data: assignedTutorIds = [] } = useQuery<string[]>({
    queryKey: ["/api/coo/all-tutor-assignments"],
    enabled: isAuthenticated && !authLoading,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    if (podsError && isUnauthorizedError(podsError)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [podsError, toast]);

  const createPod = useMutation({
    mutationFn: async (data: typeof formData) => {
      await apiRequest("POST", "/api/coo/pods", {
        podName: data.podName,
        podType: data.podType,
        vehicle: data.vehicle,
        tdId: data.tdId || null,
        status: "active",
        startDate: new Date().toISOString(),
        tutorIds: data.tutorIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coo/pods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coo/stats"] });
      setDialogOpen(false);
      setFormData({
        podName: "",
        podType: "training",
        vehicle: "4_seater",
        tdId: "",
        tutorIds: [],
      });
      toast({
        title: "Pod created",
        description: "The Pod is ready.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({
        title: "Could not create Pod",
        description: "No Pod was created. Try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.podName.trim()) {
      toast({
        title: "Pod name required",
        description: "Enter a name before creating the Pod.",
        variant: "destructive",
      });
      return;
    }
    createPod.mutate(formData);
  };

  if (authLoading || podsLoading || tdsLoading || specialistsLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  const getStatusColor = (status: string) =>
    status === "active"
      ? "bg-emerald-500/10 text-foreground border-emerald-500/25"
      : "bg-sky-500/10 text-foreground border-sky-500/25";

  const getTDName = (tdId: string | null) => {
    if (!tdId) return "Not assigned";
    return tds?.find((td) => td.id === tdId)?.name || "Unknown";
  };

  const availableSpecialists =
    approvedTutors?.filter((specialist) => !assignedTutorIds.includes(specialist.id)) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Operations
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              Pods
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create Pods, assign ownership and set the student capacity each Specialist can carry.
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-create-pod">
                <Plus className="h-4 w-4" />
                Create Pod
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-2xl">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Pod</DialogTitle>
                  <DialogDescription>
                    Define the operating setup. Territory Director and Specialist assignments can also be completed later.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-5">
                  <section className="border border-border/70 p-4">
                    <div className="mb-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Pod identity
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Use a clear operating name that will remain recognisable in TD and COO views.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="podName">Pod name</Label>
                      <Input
                        id="podName"
                        placeholder="Foundation Pod 3"
                        value={formData.podName}
                        onChange={(event) =>
                          setFormData({ ...formData, podName: event.target.value })
                        }
                        data-testid="input-pod-name"
                      />
                    </div>
                  </section>

                  <section className="border border-border/70 p-4">
                    <div className="mb-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Operating model
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Set the Pod type and the maximum student load carried by each Specialist.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="podType">Pod type</Label>
                        <Select
                          value={formData.podType}
                          onValueChange={(value) =>
                            setFormData({ ...formData, podType: value })
                          }
                        >
                          <SelectTrigger id="podType" data-testid="select-pod-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="training">Training</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vehicle">Student capacity per Specialist</Label>
                        <Select
                          value={formData.vehicle}
                          onValueChange={(value) =>
                            setFormData({ ...formData, vehicle: value })
                          }
                        >
                          <SelectTrigger id="vehicle" data-testid="select-vehicle">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4_seater">4 students per Specialist</SelectItem>
                            <SelectItem value="5_seater">5 students per Specialist</SelectItem>
                            <SelectItem value="6_seater">6 students per Specialist</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          A Pod can hold up to {MAX_SPECIALISTS_PER_POD} Specialists.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="border border-border/70 p-4">
                    <div className="mb-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Ownership
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Assign a Territory Director now or leave ownership open for later.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="td">Territory Director</Label>
                      <Select
                        value={formData.tdId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, tdId: value === "none" ? "" : value })
                        }
                      >
                        <SelectTrigger id="td" data-testid="select-td">
                          <SelectValue placeholder="Assign later" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Assign later</SelectItem>
                          {tds?.map((td) => (
                            <SelectItem key={td.id} value={td.id}>
                              {td.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </section>

                  <section className="border border-border/70 p-4">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Initial Specialists
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Optional. Only unassigned, Pod-eligible Specialists are shown.
                        </p>
                      </div>
                      <Badge variant="outline" className="w-fit">
                        {formData.tutorIds.length}/{MAX_SPECIALISTS_PER_POD} selected
                      </Badge>
                    </div>

                    {!approvedTutors || approvedTutors.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No Pod-eligible Specialists are available yet.
                      </p>
                    ) : availableSpecialists.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        All Pod-eligible Specialists are already assigned.
                      </p>
                    ) : (
                      <div className="max-h-52 space-y-1 overflow-y-auto border border-border/70">
                        {availableSpecialists.map((specialist) => (
                          <label
                            key={specialist.id}
                            htmlFor={`specialist-${specialist.id}`}
                            className="flex cursor-pointer items-start gap-3 border-b border-border/60 px-3 py-3 last:border-b-0 hover:bg-muted/30"
                          >
                            <Checkbox
                              id={`specialist-${specialist.id}`}
                              checked={formData.tutorIds.includes(specialist.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  if (formData.tutorIds.length >= MAX_SPECIALISTS_PER_POD) {
                                    toast({
                                      title: "Pod Specialist limit reached",
                                      description: `A Pod can have up to ${MAX_SPECIALISTS_PER_POD} Specialists.`,
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  setFormData({
                                    ...formData,
                                    tutorIds: [...formData.tutorIds, specialist.id],
                                  });
                                  return;
                                }
                                setFormData({
                                  ...formData,
                                  tutorIds: formData.tutorIds.filter(
                                    (id) => id !== specialist.id,
                                  ),
                                });
                              }}
                              data-testid={`checkbox-specialist-${specialist.id}`}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">
                                {specialist.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {specialist.email}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={createPod.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createPod.isPending}
                    data-testid="button-submit-pod"
                  >
                    {createPod.isPending ? "Creating..." : "Create Pod"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!pods || pods.length === 0 ? (
            <Card className="sm:col-span-2 rounded-none border p-8 text-center sm:p-12">
              <FolderKanban className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No Pods yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the first Pod when its operating setup is ready.
              </p>
            </Card>
          ) : (
            pods.map((pod) => {
              const podType = (pod as any).pod_type || (pod as any).podType;
              const vehicle = (pod as any).vehicle;
              return (
                <Link key={pod.id} to={`${cooPodsBasePath}/${pod.id}`}>
                  <Card
                    className="cursor-pointer space-y-4 rounded-none border p-4 transition-colors hover:border-primary/40 hover:bg-muted/20 sm:p-5"
                    data-testid={`pod-card-${pod.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-primary/20 bg-primary/5">
                          <FolderKanban className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold">
                            {(pod as any).pod_name || pod.podName}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatPodType(podType)} · {formatStudentCapacity(vehicle)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          className={`${getStatusColor(pod.status)} border text-[10px] font-semibold uppercase`}
                        >
                          {pod.status}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Territory Director</span>
                        <span className="truncate font-medium">
                          {getTDName((pod as any).td_id || pod.tdId)}
                        </span>
                      </div>
                      {((pod as any).start_date || pod.startDate) ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Started {new Date(
                            (pod as any).start_date || pod.startDate,
                          ).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
