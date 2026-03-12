export type Section = {
  heading: string;
  summary: string;
};

export type SummaryResponse = {
  title: string;
  source: string;
  url: string;
  one_line_summary: string;
  key_points: string[];
  sections: Section[];
  cautions: string[];
  warning?: string;
};
