const fs = require('fs');
const path = require('path');

const podfilePath = path.join(__dirname, '../ios/Podfile');

if (fs.existsSync(podfilePath)) {
  let content = fs.readFileSync(podfilePath, 'utf8');
  const searchString = 'post_install do |installer|';
  
  if (content.includes(searchString)) {
    const insertion = `
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
      config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
    end
  end
`;
    content = content.replace(searchString, searchString + insertion);
    fs.writeFileSync(podfilePath, content, 'utf8');
    console.log('Successfully patched ios/Podfile to disable signing for all pod targets.');
  } else {
    console.log('Warning: post_install block not found in ios/Podfile!');
  }
} else {
  console.log('Error: ios/Podfile not found!');
  process.exit(1);
}
