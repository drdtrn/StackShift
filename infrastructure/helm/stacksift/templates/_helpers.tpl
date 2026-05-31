{{/* Common labels applied to every object. */}}
{{- define "stacksift.labels" -}}
app.kubernetes.io/name: stacksift
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{/* Per-component selector labels. Usage: include "stacksift.selector" (dict "ctx" . "component" "api") */}}
{{- define "stacksift.selector" -}}
app.kubernetes.io/name: stacksift
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/* Resolve an image ref. Usage: include "stacksift.image" (dict "img" .Values.images.api "reg" .Values.images.registry) */}}
{{- define "stacksift.image" -}}
{{ .reg }}/{{ .img.repo }}:{{ .img.tag }}
{{- end -}}

{{/* The pre-created app Secret name. */}}
{{- define "stacksift.appSecret" -}}{{ .Values.global.appSecretName }}{{- end -}}

{{/* cert-manager annotation key for the configured issuer kind. */}}
{{- define "stacksift.certAnnoKey" -}}
{{- if eq .Values.certIssuer.kind "ClusterIssuer" -}}cert-manager.io/cluster-issuer{{- else -}}cert-manager.io/issuer{{- end -}}
{{- end -}}

{{/* Active issuer name (staging vs prod). */}}
{{- define "stacksift.certIssuerName" -}}
{{- if .Values.certIssuer.useStaging -}}{{ .Values.certIssuer.name }}-staging{{- else -}}{{ .Values.certIssuer.name }}{{- end -}}
{{- end -}}
