{{- define "life-planning.name" -}}life-planning{{- end }}
{{- define "life-planning.labels" -}}
app.kubernetes.io/name: {{ include "life-planning.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
