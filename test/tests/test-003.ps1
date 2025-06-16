[string[]]$test_files = @()
Get-ChildItem -Path "$PSScriptRoot\..\input\test-003" -Filter *.xml | 
	Foreach-Object {
		
		$test_files += $_.FullName
	}

node $PSScriptRoot\..\test-runner.js --mode sl --nomarkup --src $test_files