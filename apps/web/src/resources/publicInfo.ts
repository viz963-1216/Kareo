import type { ProviderPublicInfo, ResourceCategory } from "../types/api";
export const assistiveProgramLabels = { PURCHASE: "輔具購置", SMART_TECH: "智慧科技輔具" };
export function resourceServices(category: ResourceCategory, services: string[], info?: ProviderPublicInfo): string {
  return info?.publicServices.length ? info.publicServices.join("、") : services.length ? services.join("、") : category === "ASSISTIVE_DEVICE_CENTER" ? "輔具公共服務（請洽中心確認項目與時段）" : "服務項目待確認";
}
