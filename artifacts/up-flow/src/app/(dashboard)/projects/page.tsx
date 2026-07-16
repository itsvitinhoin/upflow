"use client";

import Header from "@/components/layout/header";
import ProjectDirectory from "@/components/projects/project-directory";
import { useLanguage } from "@/components/language-provider";

export default function ProjectsPage() {
  const { t } = useLanguage();
  return (
    <>
      <Header title={t("projects.title")} />
      <ProjectDirectory />
    </>
  );
}
