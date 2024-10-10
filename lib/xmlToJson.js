module.exports = traverse;

const characterDataStartSequence = '<![CDATA[';
const characterDataEndSequence = ']]>';

function escapeCharacterDataSequence(data) {
  if (!data.trim().startsWith(characterDataStartSequence)) {
    return data;
  }

  const start = data.indexOf(characterDataStartSequence);
  const end = data.indexOf(characterDataEndSequence);

  if (start === -1 || end === -1 || end !== data.length-3) {
    return data;
  }

  return data.substring(start + 9, end);
}

function isCharacterDataSequence(data) {
  return data.trim().startsWith(characterDataStartSequence);
}

function traverse(xml, attributeMode, attributesData) {
  const tagFinder = new RegExp('<([^!\\/].*?)[>|\\s|/]', 'g'); //find the current tag we are working on
  const attributesValuesFinder = new RegExp(`(?<=\\s)([A-Za-z1-9\\-\\_\\$\\#]*)(\\=['"])(.*?)(['"])(?=\\s)`, 'g');

  const json = {};
  let tagShouldBeArray = false;

  //recursion base case
  if (xml === '' || (xml.charAt(0) !== '<' && xml.charAt(xml.length - 1) !== '>')) {
    return xml;
  }
  
  if (!attributesData) {
    attributesData = [];

    for (const attribute of xml.matchAll(attributesValuesFinder)) {
      if (attribute[3].startsWith(`"`) || attribute[3].startsWith(`'`) || attribute[3].startsWith(`<`)) {
        const dataIndex = attributesData.length;
        const toReplaceWith = `${attribute[1]}${attribute[0].slice(attribute[1].length).replace(attribute[3], `**internalAttrData[${dataIndex}]**`)}`;
        attributesData.push(attribute[3]);
        
        xml = xml.replace(attribute[0], toReplaceWith);
      }
    }
  }

  var currentLevelTags;
  var skip = 0;
  while ((currentLevelTags = tagFinder.exec(xml)) !== null) {
    let selfClosing = false;
    const tag = currentLevelTags[1];

    const finishTag = '</' + tag + '>';
    const input = currentLevelTags.input;
    const tagLength = input.indexOf('>', skip) + 1;

    const start = currentLevelTags.index;
    const end = currentLevelTags.input.indexOf('>', start) + 1;
    const currentTag = currentLevelTags.input.substring(start, end);

    selfClosing = isSelfClosing(currentTag);

    if (!validate(currentTag)) {
      const err = new Error('Invalid XML tag');
      throw err;
    }
    //const closingTagIndex = input.indexOf(finishTag,tagLength);
    const closingTagIndex = findClosingIndex(input, finishTag, tagLength);
    if (selfClosing === false && closingTagIndex < 0) {
      const err = new Error('Invalid XML');
      throw err;
    }

    let substring; //substring will be either all child tags or if self closing tag just a blank string. i.e: <employee><name>Alex</name></employee> : <name>Alex</name> will be the substring of the <employee> parent tag
    let isSubstringCharacterData = false;
    if (selfClosing) {
      substring = '';
      skip = currentTag.length + skip;
    } else {
      substring = input.substring(input.indexOf('>', skip) + 1, closingTagIndex);
      skip = tagLength + substring.length + finishTag.length;
      isSubstringCharacterData = isCharacterDataSequence(substring);
      substring = escapeCharacterDataSequence(substring);
    }

    tagFinder.lastIndex = skip; //skip all child tags of current level

    if (!json[tag]) {
      json[tag] = {};
    } else {
      tagShouldBeArray = true;
    }


    let temporary = {};
    let attributes;
    if (attributeMode) {
      attributes = collectAttributes(currentTag, attributesData);
    }

    //if currentTag contains attributes and attributeMode is enabled, attach them to json
    if (tagShouldBeArray && attributeMode) {
      temporary = attributes;

    } else if (!tagShouldBeArray && attributeMode) {
      for (let key in attributes) {
        json[tag][key] = attributes[key];
      }
    }


    //go one level deeper
    const next = isSubstringCharacterData ? substring : traverse(substring, attributeMode, attributesData);

    //when returning from recursion, build up the json

    if (typeof next === 'object') {
      //const key = Object.keys(next)[0];
      try {
        if (tagShouldBeArray && !json[tag].length) {
          const temp = json[tag];
          json[tag] = [temp];
          const nextObj = {}
          for (let key in next) {
            nextObj[key] = next[key];
          }
          temporary = { ...temporary, ...nextObj };
          json[tag].push(temporary);
        } else if (tagShouldBeArray) {
          const nextObj = {};
          for (let key in next) {
            nextObj[key] = next[key];
          }
          temporary = { ...temporary, ...nextObj };
          json[tag].push(temporary);
        } else {
          for (let key in next) {
            json[tag][key] = next[key];
          }
        }
      } catch (err) {
        console.log(`Failed to add ${JSON.stringify(next)} to ${tag}`);
        throw err;
      }


    } else if (Object.keys(json[tag]).length > 0) {

      if ((tagShouldBeArray && !json[tag].length) || typeof json[tag] === 'string') {
        const temp = json[tag];
        json[tag] = [temp];

        if (typeof next !== 'object') {
          if (Object.keys(temporary).length === 0) {
            json[tag].push(next);
          } else {
            // temporary['data'] = next;
            if (next !== '') {
              temporary['textNode'] = next;
            }
            json[tag].push(temporary);
          }


        } else {
          temporary = { ...temporary, next };
          json[tag].push(next);
        }
        //json[tag].push(next);

      } else if (tagShouldBeArray) {
        //json[tag].push(next);
        if (typeof next !== 'object') {
          if (Object.keys(temporary).length === 0) {
            json[tag].push(next);
          } else {
            //temporary['data'] = next;
            if (next !== '') {
              temporary['textNode'] = next;
            }
            json[tag].push(temporary);
          }


        } else {
          temporary = { ...temporary, next };
          json[tag].push(next);
        }

      } else {
        if (next !== '') {
          json[tag] = {
            ...json[tag],
            textNode: next
          }
        }

      }

    } else {
      if (tagShouldBeArray && typeof json[tag] !== 'object') {
        const temp = json[tag];
        json[tag] = [];
        json[tag].push(...temp, next);
      } else {
        json[tag] = next;
      }
      //json[tag] = next;
    }

  }


  return json;
}




//Helper methods

//Determine if a tag is self closing or not. Could be improved
function isSelfClosing(currentTag) {
  if (currentTag.indexOf('/>') > -1) {
    return true;
  }
  return false;
}

//Collect all the attributes of the current tag and return an object in form of {attribute:values}
function collectAttributes(currentTag, attributesData) {
  const attributeFinder = new RegExp('(\\S*)="(.*?)"', 'g');
  const foundAttributes = {};

  let attributes
  while ((attributes = attributeFinder.exec(currentTag)) !== null) {
    const key = attributes[1];
    const value = attributes[2];

    foundAttributes[key] = value.startsWith('**internalAttrData') ? attributesData[parseInt(value.replace('**internalAttrData[', '').replace(']**', ''))] : value;
  }

  return foundAttributes;
}

function validate(currentTag) {
  if ((currentTag.charAt(0) === '<' && currentTag.charAt(1) === '?') && (currentTag.charAt(currentTag.length - 1) === '>' && currentTag.charAt(currentTag.length - 2) === '?')) {
    return true;
  }

  if (currentTag.charAt(0) === '<' && (currentTag.charAt(currentTag.length - 2) + currentTag.charAt(currentTag.length - 1) === '/>' || currentTag.charAt(currentTag.length - 1) === '>')) {
    return true;
  }

  return false;
}


function findClosingIndex(searchString, tag, start) {

  const openinTag = tag.replace('</', '<').replace('>', '');
  let closingIndex = searchString.indexOf(tag, start);
  let openingIndex = searchString.indexOf(openinTag, start);

  if (closingIndex < openingIndex) {
    return closingIndex;
  }

  const sub = searchString.substr(openingIndex, closingIndex - openingIndex);

  if (!sub.match(new RegExp(openinTag + "\\W"))) {
    return closingIndex;
  }

  while (closingIndex > 0) {
    const tempIndex = searchString.indexOf(tag, closingIndex + 1);
    if (tempIndex > 0) {
      closingIndex = tempIndex;
    } else {
      break;
    }
  }

  return closingIndex;
}