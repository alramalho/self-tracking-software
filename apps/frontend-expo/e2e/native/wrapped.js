var result = http.get('http://127.0.0.1:4319/__state');
if(result.status!==200)throw new Error('Could not read wrapped fixtures');
output.theme = JSON.parse(result.body).user.themeMode;
