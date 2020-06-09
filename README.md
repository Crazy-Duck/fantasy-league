# Fantasy League

## Prerequisites

Node JS >= 14 which you can download [here](https://nodejs.org/en/download/current/).

## Install

```Bash
$> npm install
```


## Usage

```Bash
$> node ./graphql.js [ticket] [maxTotal]
```

The script will pull all the matches played on the given ticket in batches of 10, calculate the fantasy points and write them to a `matches.json` file. You can optionally elect to only fetch the `[maxTotal]` most recent matches.

## Limitation

For matches more than 90 days old fantasy points cannot be calculated.