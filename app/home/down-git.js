/***********************************************************
* Developer: Minhas Kamal (minhaskamal024@gmail.com)       *
* Website: https://github.com/MinhasKamal/DownGit          *
* License: MIT License                                     *
***********************************************************/

var downGitModule = angular.module('downGitModule', [
]);

downGitModule.factory('downGitService', [
    '$http',
    '$q',

    function ($http, $q) {
        var repoInfo = {};

        var parseInfo = function(parameters) {
            // 如果 URL 包含 /raw/refs/heads/ 则转换格式
            if (parameters.url.indexOf("/raw/refs/heads/") !== -1) {
                var parts = new URL(parameters.url).pathname.split("/"); // ['', author, repository, "raw", "refs", "heads", branch, ...]
                var info = {};
                info.isRaw = true;
                info.author = parts[1];
                info.repository = parts[2];
                info.branch = parts[6];
                info.resPath = parts.slice(7).join("/");
                // 转换成 ghproxy.net 格式
                info.downloadUrl = parameters.url.replace("https://github.com/", "https://ghproxy.net/https://raw.githubusercontent.com/").replace("/raw/refs/heads/", "/");
                // 使用用户传入的文件名及根目录参数
                if(!parameters.fileName || parameters.fileName==""){
                    info.downloadFileName = parts[parts.length-1];
                } else{
                    info.downloadFileName = parameters.fileName;
                }
                if(parameters.rootDirectory=="false"){
                    info.rootDirectoryName = "";
                } else if(!parameters.rootDirectory || parameters.rootDirectory=="" ||
                    parameters.rootDirectory=="true"){
                    info.rootDirectoryName = parts[parts.length-1]+"/";
                } else{
                    info.rootDirectoryName = parameters.rootDirectory+"/";
                }
                return info;
            }
            // ...existing代码用于处理一般 GitHub URL...
            var repoPath = new URL(parameters.url).pathname;
            var splitPath = repoPath.split("/");
            var info = {};
            info.author = splitPath[1];
            info.repository = splitPath[2];
            info.branch = splitPath[4];
            info.rootName = splitPath[splitPath.length-1];
            if(!!splitPath[4]){
                info.resPath = repoPath.substring(
                    repoPath.indexOf(splitPath[4])+splitPath[4].length+1
                );
            }
            info.urlPrefix = "https://api.github.com/repos/"+
                info.author+"/"+info.repository+"/contents/";
            info.urlPostfix = "?ref="+info.branch;
            if(!parameters.fileName || parameters.fileName==""){
                info.downloadFileName = info.rootName;
            } else{
                info.downloadFileName = parameters.fileName;
            }
            if(parameters.rootDirectory=="false"){
                info.rootDirectoryName = "";
            } else if(!parameters.rootDirectory || parameters.rootDirectory=="" ||
                parameters.rootDirectory=="true"){
                info.rootDirectoryName = info.rootName+"/";
            } else{
                info.rootDirectoryName = parameters.rootDirectory+"/";
            }
            return info;
        }

        var downloadDir = function(progress){
            progress.isProcessing.val = true;

            var dirPaths = [];
            var files = [];
            var requestedPromises = [];

            dirPaths.push(repoInfo.resPath);
            mapFileAndDirectory(dirPaths, files, requestedPromises, progress);
        }

        var mapFileAndDirectory = function(dirPaths, files, requestedPromises, progress){
            $http.get(repoInfo.urlPrefix+dirPaths.pop()+repoInfo.urlPostfix).then(function(response) {
                for(var i=response.data.length-1; i>=0; i--){
                    if(response.data[i].type=="dir"){
                        dirPaths.push(response.data[i].path);

                    } else{
                        if(response.data[i].download_url){
                            getFile(response.data[i].path,
                                response.data[i].download_url,
                                files, requestedPromises, progress
                            );
                        } else {
                            console.log(response.data[i]);
                        }
                    }
                }

                if(dirPaths.length<=0){
                    downloadFiles(files, requestedPromises, progress);
                } else{
                    mapFileAndDirectory(dirPaths, files, requestedPromises, progress);
                }
            });
        }

        var downloadFiles = function(files, requestedPromises, progress){
            var zip = new JSZip();
            $q.all(requestedPromises).then(function(data) {
                for(var i=files.length-1; i>=0; i--){
                    zip.file(
                        repoInfo.rootDirectoryName+files[i].path.substring(decodeURI(repoInfo.resPath).length+1),
                        files[i].data
                    );
                }

                progress.isProcessing.val=false;
                zip.generateAsync({type:"blob"}).then(function(content) {
                    saveAs(content, repoInfo.downloadFileName+".zip");
                });
            });
        }

        var getFile = function (path, url, files, requestedPromises, progress) {
            var promise = $http.get(url, {responseType: "arraybuffer"}).then(function (file) {
                files.push({path:path, data:file.data});
                progress.downloadedFiles.val = files.length;
            }, function(error) {
                console.log(error);
            });

            requestedPromises.push(promise);
            progress.totalFiles.val = requestedPromises.length;
        }

        var downloadFile = function (url, progress, toastr) {
            progress.isProcessing.val=true;
            progress.downloadedFiles.val = 0;
            progress.totalFiles.val = 1;

            var zip = new JSZip();
            $http.get(url, {responseType: "arraybuffer"}).then(function (file) {
                progress.downloadedFiles.val = 1;
                zip.file(repoInfo.rootName, file.data);

                progress.isProcessing.val=false;
                zip.generateAsync({type:"blob"}).then(function(content) {
                    saveAs(content, repoInfo.downloadFileName+".zip");
                });
            }, function(error) {
                console.log(error);
                progress.isProcessing.val=false;
                toastr.warning("Error! Server failure or wrong URL.", {iconClass: 'toast-down'});
            });
        }

        return {
            downloadZippedFiles: function(parameters, progress, toastr) {
                repoInfo = parseInfo(parameters);

                // 如果是原始 raw URL，则直接下载
                if (repoInfo.isRaw) {
                    downloadFile(repoInfo.downloadUrl, progress, toastr);
                    return;
                }

                if(!repoInfo.resPath || repoInfo.resPath==""){
                    if(!repoInfo.branch || repoInfo.branch==""){
                        repoInfo.branch="master";
                    }

                    var downloadUrl = "https://github.com/"+repoInfo.author+"/"+
                        repoInfo.repository+"/archive/"+repoInfo.branch+".zip";

                    window.location = downloadUrl;

                }else{
                    $http.get(repoInfo.urlPrefix+repoInfo.resPath+repoInfo.urlPostfix).then(function(response) {
                        if(response.data instanceof Array){
                            downloadDir(progress);
                        }else{
                            downloadFile(response.data.download_url, progress, toastr);
                        }

                    }, function(error) {
                        console.log("probable big file.");
                        downloadFile("https://ghproxy.net/https://raw.githubusercontent.com/"+repoInfo.author+"/"+
                                repoInfo.repository+"/"+repoInfo.branch+"/"+repoInfo.resPath,
                                progress, toastr);
                    });
                }
            },
        };
    }
]);
