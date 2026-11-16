/**
 * Resource queries and mutations.
 *
 * Purpose: wrap the generic CRUD client in TanStack Query so every screen
 *          caches, invalidates and reports errors the same way.
 * Inputs:  a resource key (from api/resources RESOURCE_APIS) and params
 * Outputs: query and mutation objects
 * Deps:    @tanstack/react-query, api/resources
 *
 * Query keys are `[resource, 'list', params]` and `[resource, 'detail', id]`.
 * Every mutation invalidates `[resource]`, which covers both — a create changes
 * the list, an update changes the list *and* the detail, and distinguishing
 * them saves one request at the cost of a stale row after an edit.
 *
 * `placeholderData: keepPreviousData` on lists is what makes paging and
 * filtering feel continuous: the previous page stays on screen, dimmed, instead
 * of the grid collapsing to a spinner and back on every keystroke.
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { RESOURCE_APIS } from '../api/resources.js';

/** @param {string} resource a RESOURCE_APIS key, e.g. 'movies' */
function apiFor(resource) {
  const api = RESOURCE_APIS[resource];
  if (!api) {
    throw new Error(`Unknown resource "${resource}"`);
  }
  return api;
}

export const resourceKeys = {
  all: (resource) => [resource],
  list: (resource, params) => [resource, 'list', params],
  detail: (resource, id) => [resource, 'detail', id],
};

/**
 * A paginated list.
 * @returns {{items: object[], meta: object|null, ...}} the query, with `items`
 *          and `meta` lifted out of `data` for convenience
 */
export function useResourceList(resource, params = {}, options = {}) {
  const query = useQuery({
    queryKey: resourceKeys.list(resource, params),
    queryFn: () => apiFor(resource).list(params),
    placeholderData: keepPreviousData,
    ...options,
  });

  return {
    ...query,
    items: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
  };
}

/** One document. Skipped when `id` is absent, so a "new" form can share it. */
export function useResourceDetail(resource, id, options = {}) {
  return useQuery({
    queryKey: resourceKeys.detail(resource, id),
    queryFn: () => apiFor(resource).get(id),
    enabled: Boolean(id),
    ...options,
  });
}

/**
 * Create, update, status and delete for one resource.
 *
 * Each is a separate mutation so a screen can track their pending states apart
 * — a row's status toggle must not disable the form's save button.
 */
export function useResourceMutations(resource) {
  const queryClient = useQueryClient();
  const api = apiFor(resource);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: resourceKeys.all(resource) });

  const create = useMutation({
    mutationFn: (payload) => api.create(payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }) => api.update(id, payload),
    onSuccess: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, isActive }) => api.setStatus(id, isActive),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id) => api.remove(id),
    onSuccess: invalidate,
  });

  return { create, update, setStatus, remove, invalidate };
}

/**
 * Every row of a resource, for a `<select>`.
 *
 * Deliberately unpaginated at 100 — the API's hard cap — because that is what a
 * dropdown can hold. Resources that outgrow it (movies, casts) must use a
 * search-as-you-type picker instead of this; genres, categories and age ranges
 * never will.
 *
 * `isActive` is not filtered: a record already pointing at a deactivated genre
 * must still show that genre in its form, or saving would silently drop it.
 *
 * `valueKey` exists because not every relation is stored by id: a movie's
 * `country` holds the country CODE ("IR"), not the Country document's `_id`.
 */
export function useLookupOptions(
  resource,
  { labelKey = 'nameFa', valueKey = '_id', sort = 'name_fa' } = {},
) {
  const query = useQuery({
    queryKey: [resource, 'lookup', labelKey, valueKey, sort],
    queryFn: () => apiFor(resource).list({ limit: 100, item_sort: sort, sort_type: 'ASC' }),
    // Reference data changes rarely; a five-minute window avoids refetching it
    // on every form open.
    staleTime: 5 * 60_000,
  });

  const options = (query.data?.items ?? []).map((item) => ({
    value: item[valueKey],
    label: item[labelKey] || item.nameEn || item.name || item._id,
    isActive: item.isActive,
    // The source document, for callers that must decide something the label
    // cannot answer — a category's clip-ness reads both name fields, not just
    // whichever one `labelKey` picked.
    raw: item,
  }));

  return { ...query, options };
}

export default useResourceList;
