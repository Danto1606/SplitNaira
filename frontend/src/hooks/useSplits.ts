import { useQuery } from "@tanstack/react-query";
import {
  getAllSplits,
  getSplit,
  getProjectHistory,
  getClaimable,
  getTokenAllowlist,
  getAdminStatus,
  getUnallocatedBalance,
} from "@/lib/api";

export const splitKeys = {
  all: ["splits"] as const,
  list: () => [...splitKeys.all, "list"] as const,
  detail: (projectId: string) => [...splitKeys.all, "detail", projectId] as const,
  history: (projectId: string) => [...splitKeys.all, "history", projectId] as const,
  claimable: (projectId: string, address: string) =>
    [...splitKeys.all, "claimable", projectId, address] as const,
  allowlist: (start: number, limit: number) =>
    [...splitKeys.all, "allowlist", start, limit] as const,
  adminStatus: () => [...splitKeys.all, "adminStatus"] as const,
  unallocated: (token: string) => [...splitKeys.all, "unallocated", token] as const,
};

export function useAllSplits() {
  return useQuery({
    queryKey: splitKeys.list(),
    queryFn: getAllSplits,
  });
}

export function useSplit(projectId: string) {
  return useQuery({
    queryKey: splitKeys.detail(projectId),
    queryFn: () => getSplit(projectId),
    enabled: Boolean(projectId),
  });
}

export function useProjectHistory(projectId: string) {
  return useQuery({
    queryKey: splitKeys.history(projectId),
    queryFn: () => getProjectHistory(projectId),
    enabled: Boolean(projectId),
  });
}

export function useClaimable(projectId: string, address: string) {
  return useQuery({
    queryKey: splitKeys.claimable(projectId, address),
    queryFn: () => getClaimable(projectId, address),
    enabled: Boolean(projectId) && Boolean(address),
  });
}

export function useTokenAllowlist(start = 0, limit = 100) {
  return useQuery({
    queryKey: splitKeys.allowlist(start, limit),
    queryFn: () => getTokenAllowlist(start, limit),
  });
}

export function useAdminStatus() {
  return useQuery({
    queryKey: splitKeys.adminStatus(),
    queryFn: getAdminStatus,
  });
}

export function useUnallocatedBalance(token: string) {
  return useQuery({
    queryKey: splitKeys.unallocated(token),
    queryFn: () => getUnallocatedBalance(token),
    enabled: Boolean(token),
  });
}
