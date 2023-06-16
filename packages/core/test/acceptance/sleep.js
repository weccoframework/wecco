
exports.sleep = async function sleep(millis = 10) {
    return new Promise(resolve => setTimeout(resolve, millis))
}