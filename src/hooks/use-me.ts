import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { me as meFn } from "@/lib/auth.functions";

export function useMe() {
  const fetchMe = useServerFn(meFn);
  const query = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
    staleTime: 30_000,
  });
  return { me: query.data ?? null, isLoading: query.isLoading };
}
