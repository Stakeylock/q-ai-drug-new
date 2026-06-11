"use client";

import { useCallback, useEffect, useState } from "react";
import { del, get, post, put } from "@/services";

type MutationMethod = "POST" | "PUT" | "DELETE";

type QueryParams = Record<string, string | number | boolean | undefined | null>;

interface UseFetchOptions {
  params?: QueryParams;
  enabled?: boolean;
}

interface UseFetchResult<TData> {
  data: TData | null;
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
  refetch: () => Promise<TData>;
}

interface UseMutationOptions<TVariables> {
  method?: MutationMethod;
  onSuccess?: (data: unknown, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
}

interface UseMutationResult<TData, TVariables> {
  data: TData | null;
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
  mutate: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error("Unknown error");
}

export function useFetch<TData>(
  path: string,
  options: UseFetchOptions = {},
): UseFetchResult<TData> {
  const { params, enabled = true } = options;
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await get<TData>(path, { params });
      setData(response);
      setIsSuccess(true);
      return response;
    } catch (err) {
      const normalized = normalizeError(err);
      setError(normalized);
      setIsSuccess(false);
      throw normalized;
    } finally {
      setIsLoading(false);
    }
  }, [params, path]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    void refetch();
  }, [enabled, refetch]);

  return {
    data,
    isLoading,
    error,
    isSuccess,
    refetch,
  };
}

export function useMutation<TData, TVariables = unknown>(
  path: string,
  options: UseMutationOptions<TVariables> = {},
): UseMutationResult<TData, TVariables> {
  const { method = "POST", onSuccess, onError } = options;
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const mutate = useCallback(
    async (variables: TVariables) => {
      setIsLoading(true);
      setError(null);
      setIsSuccess(false);

      try {
        let response: TData;

        if (method === "POST") {
          response = await post<TData>(path, { body: variables });
        } else if (method === "PUT") {
          response = await put<TData>(path, { body: variables });
        } else {
          response = await del<TData>(path, { body: variables });
        }

        setData(response);
        setIsSuccess(true);
        onSuccess?.(response, variables);
        return response;
      } catch (err) {
        const normalized = normalizeError(err);
        setError(normalized);
        setIsSuccess(false);
        onError?.(normalized, variables);
        throw normalized;
      } finally {
        setIsLoading(false);
      }
    },
    [method, onError, onSuccess, path],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setIsSuccess(false);
  }, []);

  return {
    data,
    isLoading,
    error,
    isSuccess,
    mutate,
    reset,
  };
}
