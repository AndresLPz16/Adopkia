export type SectionEndpointLoader = {
  key: string;
  load: () => Promise<unknown>;
};

export type SectionLoadFailure = {
  key: string;
  message: string;
};

export async function loadSectionData(
  loaders: readonly SectionEndpointLoader[],
): Promise<{
  data: Record<string, unknown>;
  failures: SectionLoadFailure[];
}> {
  const results = await Promise.allSettled(loaders.map(({ load }) => load()));
  const data: Record<string, unknown> = {};
  const failures: SectionLoadFailure[] = [];

  results.forEach((result, index) => {
    const key = loaders[index].key;
    if (result.status === "fulfilled") {
      data[key] = result.value;
      return;
    }

    failures.push({
      key,
      message:
        result.reason instanceof Error
          ? result.reason.message
          : typeof result.reason === "string"
            ? result.reason
            : "Error desconocido.",
    });
  });

  return { data, failures };
}
