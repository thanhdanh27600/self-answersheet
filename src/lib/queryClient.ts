import {QueryClient} from "@tanstack/react-query";

const DEFAULT_QUERY_STALE_TIME = 1000 * 60 * 5;

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: DEFAULT_QUERY_STALE_TIME,
		},
	},
});
