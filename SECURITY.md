# Security and privacy

DatasetMedic is a local single-user research tool. It binds to loopback and rejects foreign-origin API mutations. It is not designed to be exposed to a network or used as a hosted multi-user service.

Session identifiers are random capabilities; keep them private. Inputs and intermediate files are stored temporarily on the local disk, without encryption. Imports, reports and exports may contain sensitive values. Force-killing the application may leave temporary files in the operating system's temporary directory (`datasetmedic-*`); shut it down normally for cleanup.

Do not include sensitive datasets or credentials in issue reports. For a security issue, use GitHub's private vulnerability reporting if enabled on the repository. Otherwise open an issue containing only a request for a private reporting channel, without exploit details or private data.
