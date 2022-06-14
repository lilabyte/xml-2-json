module.exports = traverse;

function traverse(xml,attributeMode) {
    const tagFinder = new RegExp('<([^\\/].*?)[>|\\s|/]', 'g'); //find the current tag we are working on. updated regex to exclude closing tags

    const json = {};
    let tagShouldBeArray = false;
    
    //recursion base case
    if(xml === '' || (xml.charAt(0) !== '<' && xml.charAt(xml.length-1) !== '>')) {
        return xml;
    }

    var currentLevelTags;
    var skip = 0;
    while((currentLevelTags = tagFinder.exec(xml)) !== null) {
        let selfClosing = false;
        const tag = currentLevelTags[1];

        const finishTag = '</'+tag+'>';
        const input = currentLevelTags.input;
        const tagLength = input.indexOf('>',skip)+1;

        const start = currentLevelTags.index;
        const end = currentLevelTags.input.indexOf('>',start)+1;
        const currentTag = currentLevelTags.input.substring(start,end);

        selfClosing = isSelfClosing(currentTag);

        if(!validate(currentTag)) {
            const err = new Error('Invalid XML tag');
            throw err;
        }

        const closingTagIndex = findClosingIndex(input,finishTag,tagLength);
        if(selfClosing === false && closingTagIndex < 0) {
            const err = new Error('Invalid XML');
            throw err;
        }
        
        let substring; //substring will be either all child tags or if self closing tag just a blank string. i.e: <employee><name>Alex</name></employee> : <name>Alex</name> will be the substring of the <employee> parent tag
        if(selfClosing) {
            substring = '';
            skip = currentTag.length + skip;

        } else {
            substring = input.substring(tagLength, closingTagIndex);
            skip = tagLength + substring.length + finishTag.length;
        }
        

        // The index at which to start the next match
        tagFinder.lastIndex = skip; //skip all child tags of current level

        if(!json[tag]) {
            json[tag] = {};
        } else {
            tagShouldBeArray = true;
        }
        
        let temporary = {};
        let attributes;
        if(attributeMode) {
            attributes = collectAttributes(currentTag);
        }

        //if currentTag contains attributes and attributeMode is enabled, attach them to json
        if(tagShouldBeArray && attributeMode) {
            temporary = attributes;

        } else if(!tagShouldBeArray && attributeMode) {
            for(let key in attributes) {
                json[tag][key] = attributes[key];
            }
        }
        

        //go one level deeper
        const next = traverse(substring,attributeMode);
        
        //when returning from recursion, build up the json
        
        if(typeof next === 'object') {
            //const key = Object.keys(next)[0];
            if(tagShouldBeArray && !json[tag].length) {
                const temp = json[tag];

                // if the first object is empty, set json[tag] to a new empty array
                // else wrap the object in an array
                if(typeof temp === 'object' && Object.keys(temp).length === 0) {
                    json[tag] = [];
                } else {
                    json[tag] = [temp];
                }

                const nextObj = {}
                for(let key in next) {
                    nextObj[key] = next[key];
                }
                temporary = {...temporary,...nextObj};
                json[tag].push(temporary);
            }else if(tagShouldBeArray) {
                const nextObj = {};
                for(let key in next) {
                    nextObj[key] = next[key];
                }
                temporary = {...temporary,...nextObj};
                json[tag].push(temporary);
            }else {
                for(let key in next) {
                    json[tag][key] = next[key];
                }
            }
            

        } else if(Object.keys(json[tag]).length>0) {
        
            if((tagShouldBeArray  && !json[tag].length) || typeof json[tag] === 'string') {
                const temp = json[tag];
                json[tag] = [temp];
                
                if(typeof next !== 'object') {
                    if(Object.keys(temporary).length === 0) {
                        json[tag].push(next);
                    } else {
                        // temporary['data'] = next;
                        if(next !== '') {
                            temporary['textNode'] = next;
                        }
                        json[tag].push(temporary);
                    }
                    

                } else {
                    temporary = {...temporary,next};
                    json[tag].push(next);
                }
                //json[tag].push(next);

            } else if(tagShouldBeArray) {
                //json[tag].push(next);
                if(typeof next !== 'object') {
                    if(Object.keys(temporary).length === 0) {
                        json[tag].push(next);
                    } else {
                        //temporary['data'] = next;
                        if(next !== '') {
                            temporary['textNode'] = next;
                        }
                        json[tag].push(temporary);
                    }
                    

                } else {
                    temporary = {...temporary,next};
                    json[tag].push(next);
                }

            } else {
                if(next !== '') {
                    json[tag] = {
                        ...json[tag],
                        textNode: next
                    }
                }
                
            }
            
        } else {
            if(tagShouldBeArray && typeof json[tag] !== 'object') {
                const temp = json[tag];
                json[tag] = [];
                json[tag].push(...temp,next);
            }else if (Object.keys(temporary).length != 0 ) {
                // If we have content in temporary object and next string, add next to temporary
                if (next !== '') {
                    temporary['textNode'] = next;
                    json[tag] = temporary;
                } else {
                    json[tag] = temporary; // for a self closing tag with attribute, next is empty and the attribute is in object temporary
                }
            } else {
                json[tag] = next;
            }
        }
        
    }


    return json;
}




//Helper methods

//Determine if a tag is self closing or not. Could be improved
function isSelfClosing(currentTag) {
    if(currentTag.indexOf('/>') > -1) {
        return true;
    }
    return false;
}

//Collect all the attributes of the current tag and return an object in form of {attribute:values}
function collectAttributes(currentTag) {
    const attributeFinder = new RegExp('(\\S*)="(.*?)"', 'g');
    const foundAttributes = {};

    let attributes
    while((attributes = attributeFinder.exec(currentTag)) !== null) {
        const key = attributes[1];
        const value = attributes[2];

        foundAttributes[key] = value;
    }

    return foundAttributes;
}

function validate(currentTag) {
    // return true for a root element containing '?'
    if((currentTag.charAt(0) === '<' && currentTag.charAt(1) === '?') && (currentTag.charAt(currentTag.length-1) === '>' && currentTag.charAt(currentTag.length-2) === '?')) {
        return true;
    }

    // return true for either a selfclosing tag or regular tag
    if(currentTag.charAt(0) === '<' && (currentTag.charAt(currentTag.length-2)+currentTag.charAt(currentTag.length-1) === '/>' || currentTag.charAt(currentTag.length-1) === '>')) {
        return true;
    }

    return false;
}

function isMiddleTag(searchString, openTagRegex, closeTag) {
    const firstCloseTagIndex  = searchString.indexOf(closeTag);

    // Need to substring searchString to exclude opening tag to prevent false matches
    // use the length of closeTag -2 (to account for the /)
    const substr = searchString.substr(closeTag.length - 2);

    if (substr.lastIndexOfRegex(openTagRegex, firstCloseTagIndex) != -1) {
        // an opening tag has been found between the first open tag and first encountered close tag, return true
        return true;
    } else {
        // otherwise return false
        return false;
    }
}

String.prototype.indexOfRegex = function(regex, fromIndex){
    var str = fromIndex ? this.substring(fromIndex) : this;
    var match = str.match(regex);
    return match ? str.indexOf(match[0]) + fromIndex : -1;
}

String.prototype.lastIndexOfRegex = function(regex, fromIndex){
    var str = fromIndex ? this.substring(0, fromIndex) : this;
    var match = str.match(regex);
    return match ? str.lastIndexOf(match[match.length-1]) : -1;
}

// counts the number of open tags before the first closing tag
function countOpenTags(searchString, openTagRegex, closeTag) {
    // find the index of the first closing tag and then work backwards,
    // finding and counting all opening tags between it and the start of the searchString
    let startIndex = searchString.indexOf(closeTag);
    let count = 0;
    let lastCloseCount = 0;

    // declare regex for counting opening and closing tags
    const openGenericTagRegex = new RegExp(`<[^\\/](.[^<>]*?)[^\\/]>`, 'g')
    const closeGenericTagRegex = new RegExp(`<\\/[^>\\/]*>`, 'g')

    // base case when the first closeTag is the one we're looking for
    const countSubstr = searchString.substr(0, startIndex);
    let openCount = (countSubstr.match(openGenericTagRegex) || []).length;
    let closeCount = (countSubstr.match(closeGenericTagRegex) || []).length;

    while (openCount != closeCount) {

        // count opening and closing tags between start and startIndex, should be the same
        const countSubstr = searchString.substr(0, startIndex);
        openCount = (countSubstr.match(openGenericTagRegex) || []).length;
        closeCount = (countSubstr.match(closeGenericTagRegex) || []).length;

        // update the startIndex to the next closeTag
        if (openCount != closeCount) {
            startIndex = searchString.substr(startIndex + 1).indexOf(closeTag) + startIndex + 1;
        }

        // force us to exit the loop if no change has occurred
        if (closeCount === lastCloseCount) {
            break;
        }

        lastCloseCount = closeCount;

        // the default maximum nested depth for an xml document is 32
        // we can pretty safely assume that we will find what we are looking for by now or else break
        if (openCount > 32) {
            break;
        }
    }

    while (searchString.lastIndexOfRegex(openTagRegex, startIndex) !== -1 && startIndex > 0) {
        count += 1;
        // subtract 1 from the returned index so that we do not find the same occurence again
        startIndex = searchString.lastIndexOfRegex(openTagRegex, startIndex) - 1;
    }

    return count;
}


function findClosingIndex(searchString,tag,start) {

    const openinTag = tag.replace('</', '<').replace('>', '');

    // append the regex [^>\\/]*> to find any opening tags (may or may not have attributes and are NOT self closing)
    const openTagRegex = new RegExp(`${openinTag}[^>\\/]*>`, 'g')

    const lastTag = searchString.substr(searchString.length - tag.length)
    let closingIndex

    let substr = searchString.substr(start)

    // Look between the openinTag and the first found closing tag (tag)
    // and see if there is an openinTag (with a closing bracket) between the two.
    // If an opening tag is found between the first opening tag and first closing tag, grab the last closing tag.
    // Otherwise check for middle tags between the open tag and first closing tag
    // If found, count them, update the index, and grab the correct closing tag
    // Otherwise grab the first found closing tag

    if (lastTag === tag && isMiddleTag(substr, openTagRegex, tag)) {
        closingIndex  = substr.lastIndexOf(tag);

        // if closingIndex found, add start length
        if(closingIndex != -1) {
            closingIndex += start
        }

    } else if (isMiddleTag(substr, openTagRegex, tag)) {
        let count = countOpenTags(substr, openTagRegex, tag)
        let index = start
        while (count > 0) {
            // find the index of the next occurence of the closing tag
            index = searchString.indexOf(tag, index)
            // add the tag length to search beyond this closing tag
            index += tag.length
            // decrement the counter
            count -= 1
        }

        // we now have an index beyond the closing tags we need to skip
        // find the next closing tag and return this as the closingIndex
        closingIndex = searchString.indexOf(tag, index)
    } else {
        closingIndex  = searchString.indexOf(tag, start);
    }

    // looks for an occurence of openinTag that happens after the current tag, being sure to exclude self closing tags via the regex
    let openingIndex = -1
    openingIndex = searchString.indexOfRegex(openTagRegex, closingIndex);

    if(closingIndex < openingIndex) {
        return closingIndex;
    }

    const sub  = searchString.substr(openingIndex, closingIndex-openingIndex);
    
    // if no more opening tags are found, return the closing index
    if(!sub.match(new RegExp(openinTag + "\\W"))) {
        return closingIndex;
    }

    while(closingIndex > 0) {
        const tempIndex = searchString.indexOf(tag,closingIndex+1);
        if(tempIndex > 0) {
            closingIndex = tempIndex;
        } else {
            break;
        }
    }

    return closingIndex;
}