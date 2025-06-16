# tests of the service lists provided as examples in A177r6
# for %%F in ("%filename%") do set dirname=%%~dpF

node $PSScriptRoot\..\test-runner.js --mode sl --nomarkup `
	$PSScriptRoot\..\input\test-002\SAT-IP.xml
